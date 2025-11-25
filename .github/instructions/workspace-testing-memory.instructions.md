---
description: 'Testing organization and patterns for Calva extension development.'
applyTo: '**/src/extension-test/**'
---

# Structure tests across unit, integration, and E2E layers for effective Calva development.

## Test Layer Selection

Calva organizes tests into three layers for focused verification:

- **Unit tests** (`src/extension-test/unit/`): Test pure logic and functions without VS Code APIs (e.g., session analysis, glob matching). Run fast and isolated.
- **Integration tests** (`src/extension-test/integration/`): Test features requiring VS Code APIs in depth (e.g., session routing, file operations). Feature-level verification within VS Code.
- **E2E tests** (`src/extension-test/e2e-test/`): Smoke tests for overall extension functionality. Verify end-to-end behavior.

Choose the appropriate layer based on scope: unit for logic, integration for VS Code-dependent features, E2E for holistic verification.