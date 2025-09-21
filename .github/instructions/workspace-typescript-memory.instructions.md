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