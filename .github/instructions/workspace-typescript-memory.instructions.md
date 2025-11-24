---
description: 'TypeScript coding patterns and best practices for Calva extension development.'
applyTo: '**/*.{ts,tsx}'
---

# TypeScript Memory

TypeScript coding conventions and patterns that improve code quality and maintainability.

## Import Patterns

### Prefer Module Namespace Imports
When importing multiple functions from a module, use namespace imports instead of destructuring:

```typescript
// Preferred
import * as shadowCljsRuntime from './shadow-cljs-runtime';
await shadowCljsRuntime.initializeShadowRemoteNotifications();

// Instead of
import { initializeShadowRemoteNotifications } from './shadow-cljs-runtime';
await initializeShadowRemoteNotifications();
```

**Why:** This approach provides better context about where functions originate and makes it easier to track module dependencies throughout the codebase.

## Isolate VS Code Dependencies for Unit Testing

To enable fast and stable unit tests in Jest for VS Code extensions, separate VS Code-independent logic into dedicated helper modules exposing pure functions (e.g., `session-teardown.ts`, `client-registry.ts`). Reserve `vscode` imports for extension entry points like `connector.ts`, which should be covered by integration tests instead. This prevents crashes from VS Code module requirements in unit test environments.

```typescript
// session-teardown.ts (VS Code-independent, unit testable)
export function teardownSession(sessionId: string): void {
  // Pure logic for session cleanup
}

// connector.ts (VS Code-dependent, integration testable)
import * as vscode from 'vscode';
import { teardownSession } from './session-teardown';

// Use vscode APIs and call teardownSession
```

**Why:** Keeps unit tests focused on logic without extension host dependencies, while integration tests verify VS Code interactions.