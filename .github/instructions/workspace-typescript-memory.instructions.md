---
description: 'TypeScript coding patterns and best practices for Calva extension development.'
applyTo: '**/*.{ts,tsx}'
---

# TypeScript Memory

TypeScript coding conventions and patterns that improve code quality and maintainability.

## Import Patterns

### Module Namespace Imports Are Required
In Calva TypeScript and TSX code, treat module namespace imports as the default and required import style:

```typescript
// Required in normal cases
import * as shadowCljsRuntime from './shadow-cljs-runtime';
await shadowCljsRuntime.initializeShadowRemoteNotifications();

// Do not do this for Calva code
import { initializeShadowRemoteNotifications } from './shadow-cljs-runtime';
await initializeShadowRemoteNotifications();
```

Use named imports or default imports only when the module's export shape makes a namespace import incorrect or unusable. Typical exceptions are callable CommonJS-style packages, where the correct form may instead be `import x = require('...')`.

**Why:** Namespace imports make call sites show module ownership explicitly, reduce symbol ambiguity during refactors, and keep import style consistent across the Calva TypeScript codebase.

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