---
description: 'Testing organization and patterns for Calva extension development.'
applyTo: '**'
---

# Structure tests across unit, integration, and E2E layers for effective Calva development.

## Test Layer Selection

Calva organizes tests into three layers for focused verification:

- **Unit tests** (`src/extension-test/unit/`): Test pure logic and functions without VS Code APIs (e.g., session analysis, glob matching). Run fast and isolated.
- **Integration tests** (`src/extension-test/integration/`): Test features requiring VS Code APIs in depth (e.g., session routing, file operations). Feature-level verification within VS Code.
- **E2E tests** (`src/extension-test/e2e-test/`): Smoke tests for overall extension functionality. Verify end-to-end behavior.

Choose the appropriate layer based on scope: unit for logic, integration for VS Code-dependent features, E2E for holistic verification.

## Verifying Test Status

**Use `get_task_output` with the test watcher task—never run tests separately.**

The 'Calva Watch Test TS' task continuously runs the full unit test suite on every file change. When you see output like '1076 passing', that IS the current test status. There is no need to run tests via terminal commands or `runTests`—the watcher has already done it.

**Why this matters:**
- `runTests` may return '0/0' due to VS Code test discovery limitations
- Running `npm run unit-test` hangs for some reason
- The watcher output shows the authoritative, up-to-date test results

**Pattern:** After making code changes, simply call `get_task_output` for 'Calva Watch Test TS' to see if tests pass. The watcher will have already re-run the suite.

## Filtering Integration Tests

To filter which integration tests to run, pass arguments directly to the npm script using `--`:

```bash
npm run integration-test -- cljc
```

This passes the filter as a command line argument accessible via `process.argv`, ensuring reliable configuration in the VS Code Extension Host environment.