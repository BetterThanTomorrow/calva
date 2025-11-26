# Session-Connection Architecture Plan

## Context

This work is part of the **multiple concurrent nREPL connections** feature (PR #2968, Issue #76). This feature has **not been released yet**, so:

- We must remain backward compatible with the **currently released Calva** behavior
- We do **not** need any internal backward compatibility within this PR
- We can freely refactor internal architecture to support the new multi-connection model

See CHANGELOG.md "Unreleased" section for feature summary.

## Problem Statement

With multiple concurrent nREPL connections, several features break because they rely on global state that gets overwritten when a new connection is established:

1. **Build/Runtime indicators disappear** when connecting a second sequence without a promoted session
2. **Build selector (`calva.switchCljsBuild`) not working** - Likely due to broken lookup path via `getSessionKeyForRole('promoted')` to global state
3. **Runtime selector (`calva.selectShadowCljsRuntime`) not working** - Same root cause as build selector
4. **ClojureDocs lookup** uses wrong session (needs JVM Clojure, not bb/cljs)
5. **Debugger decorations** should use routed session, not global "main"
6. **Shadow-cljs runtime detection** should use the main session of the connection owning the currently routed promoted session

### Key Terminology (from CHANGELOG)

- **`replSessionNames.main`** - The main session key (defaults to `clj`)
- **`replSessionNames.promoted`** - The promoted/CLJS session key (defaults to `cljs`)
- **Re-connect** - When a new connection uses the same `replSessionNames` as an existing one, the old connection is replaced
- **Session pinning** - Lock all evaluations to a specific session, overriding glob-based routing

## Root Cause

The current architecture has a **global session role state** that tracks:
- `main` session key (e.g., "clj", "fleet-designer/clj")
- `promoted` session key (e.g., "cljs", "fleet-designer/cljs")
- Glob mappings for each session key

When `initializeSessionRoleKeys(connectSequence)` is called during connection, it **overwrites** this global state. With multiple connections, the last connection's configuration wins.

### Current Flow (Broken)

```
Connect fleet-designer (main: fleet-designer/clj, promoted: fleet-designer/cljs)
    → Global state: main=fleet-designer/clj, promoted=fleet-designer/cljs
    → Build/runtime indicators work ✓

Connect planner (main: planner/clj, no promoted)
    → Global state: main=planner/clj, promoted=undefined  ← OVERWRITES!
    → getSessionKeyForRole('promoted') returns undefined
    → Build/runtime indicators disappear ✗
    → switchCljsBuild/selectShadowCljsRuntime fail ✗
```

## Proposed Architecture

### Core Concept: Session Relationships via Connection Ownership

Instead of global session role state, track relationships through **connection ownership**:

```
SessionMetadata {
  key: string                    // e.g., "fleet-designer/cljs"
  connectionOwnerId: string      // e.g., "client-abc-123"
  isPromoted: boolean            // true for CLJS/promoted sessions
  projectRoot: string
  globs: string[]
  ...
}
```

With this, we can navigate session relationships:

```
Current routed session: "fleet-designer/cljs"
    ↓ getSessionMetadata("fleet-designer/cljs")
connectionOwnerId: "client-abc-123"
    ↓ listSessionsByClient("client-abc-123")
Sibling sessions: ["fleet-designer/clj", "fleet-designer/cljs"]
    ↓ find where isPromoted === false
Main session for this connection: "fleet-designer/clj"
```

### New Helper Functions

Add to `session-registry.ts`:

```typescript
/**
 * Find the main (non-promoted) session for the same connection as the given session.
 * Used when we need to evaluate CLJ code for a feature related to a CLJS session.
 */
export function findMainSessionForConnection(sessionKey: string): NReplSession | undefined {
  const metadata = getSessionMetadata(sessionKey);
  if (!metadata?.connectionOwnerId) {
    return undefined;
  }

  const siblingMetas = listSessionsByClient(metadata.connectionOwnerId);
  const mainMeta = siblingMetas.find(m => !m.isPromoted);
  return mainMeta ? getSession(mainMeta.key) : undefined;
}

/**
 * Find the promoted session for the same connection as the given session.
 */
export function findPromotedSessionForConnection(sessionKey: string): NReplSession | undefined {
  const metadata = getSessionMetadata(sessionKey);
  if (!metadata?.connectionOwnerId) {
    return undefined;
  }

  const siblingMetas = listSessionsByClient(metadata.connectionOwnerId);
  const promotedMeta = siblingMetas.find(m => m.isPromoted);
  return promotedMeta ? getSession(promotedMeta.key) : undefined;
}

/**
 * Get connection-specific state for the given session's connection.
 * This replaces global state lookups for things like cljsBuild, cljsTypeName, etc.
 */
export function getConnectionState(sessionKey: string): ConnectionState | undefined {
  // Implementation depends on how we restructure state storage
}
```

### State Migration: Global → Per-Connection

Currently global state that needs to become per-connection:

| Current Global State | New Per-Connection State |
|---------------------|-------------------------|
| `cljsBuild` | `connections[clientKey].cljsBuild` |
| `cljsReplTypeHasBuilds` | `connections[clientKey].hasBuilds` |
| `selectedCljsTypeName` | `connections[clientKey].cljsTypeName` |
| `session-role-keys` | Derived from session metadata |
| `session-role-globs` | Stored in session metadata (already done) |

### Implementation Plan

#### Phase 1: Connection State Registry

Create a new module `src/nrepl/connection-state.ts`:

```typescript
interface ConnectionState {
  clientKey: string;
  cljsBuild: string | null;
  cljsTypeName: string | null;
  hasBuilds: boolean;
  // Future: more per-connection state
}

const connectionStates = new Map<string, ConnectionState>();

export function getConnectionState(clientKey: string): ConnectionState | undefined;
export function setConnectionState(clientKey: string, state: Partial<ConnectionState>): void;
export function clearConnectionState(clientKey: string): void;
```

#### Phase 2: Update Session Registration

When registering sessions, ensure:
1. `connectionOwnerId` is always set
2. `isPromoted` is set correctly for CLJS sessions
3. Connection state is initialized

#### Phase 3: Update Statusbar

Replace:
```typescript
// Old: depends on global promoted session key
const promotedSessionKey = sessionRoles.getSessionKeyForRole('promoted');
if (replType === promotedSessionKey) { ... }
```

With:
```typescript
// New: checks if current session is promoted
const isCurrentSessionPromoted = sessionRegistry.isSessionPromoted(replType);
if (isCurrentSessionPromoted) {
  // Get build/runtime from this session's connection state
  const connectionState = getConnectionStateForSession(replType);
  const cljsBuild = connectionState?.cljsBuild;
  ...
}
```

#### Phase 4: Update Build/Runtime Commands

`calva.switchCljsBuild`:
1. Get currently routed session
2. Find its connection's main session
3. Use that for build switching
4. Store result in connection state (not global)

`calva.selectShadowCljsRuntime`:
1. Get currently routed session
2. Find its connection's main session
3. Use that for runtime detection
4. Store result in connection state (not global)

#### Phase 5: Update Other Consumers

**ClojureDocs lookup** (`src/api/info.ts`):
- Check nREPL describe for ClojureDocs support when connecting
- Mark session as ClojureDocs-capable in metadata
- Use the first available ClojureDocs-capable session
- Silently skip if no session supports ClojureDocs (no error to user)

**Debugger decorations** (`src/debugger/decorations.ts`):
- Use the routed session for the current file
- Existing debugger capability checks should handle unsupported sessions
- Verify this is already working correctly with routing

**Shadow-cljs runtime** (`src/shadow-cljs-runtime.ts`):
- Get currently routed promoted session
- Find its connection's main session
- Use that for runtime API calls

### Migration Strategy

1. **Keep `isPromoted` metadata** (already added) - this is correct
2. **Add connection state registry** - new module
3. **Migrate state writes** - when setting cljsBuild etc., write to connection state
4. **Migrate state reads** - update consumers to read from connection state via routed session
5. **Remove global session role state** - once all consumers migrated

### Testing Considerations

New test scenarios needed:

1. Connect sequence A (with CLJS), connect sequence B (CLJ only)
   - Build/runtime indicators should show when routed to A's CLJS
   - Build/runtime selectors should work for A

2. Connect sequence A, connect sequence B (both with CLJS, different builds)
   - Each should show its own build
   - Switching builds should only affect the routed connection

3. Disconnect sequence A while B is connected
   - B should be unaffected
   - A's state should be cleaned up

### Files to Modify

1. `src/nrepl/connection-state.ts` - NEW: per-connection state registry
2. `src/nrepl/session-registry.ts` - Add helper functions for session relationships
3. `src/statusbar.ts` - Use connection state instead of global state
4. `src/connector.ts` - Initialize/update connection state during connect
5. `src/shadow-cljs-runtime.ts` - Use routed session's connection
6. `src/api/info.ts` - Check session capabilities
7. `src/debugger/decorations.ts` - Use routed session
8. `src/nrepl/session-roles.ts` - Target for removal (functionality moved to session metadata)

### Open Questions

1. **Should we keep `session-roles.ts` at all?**
   - Likely no - the role keys are now derivable from session metadata
   - Glob mappings are stored in session metadata
   - Initial key derivation from connect sequence config can move elsewhere

2. **How to handle the "no active session" case?**
   - Verify: router should never end up here unless no session is connected
   - Existing handling is probably correct, but needs verification
