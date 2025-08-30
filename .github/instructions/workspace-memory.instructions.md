---
description: 'A memory for the AI agent working in this project. See also the prompt `add-workspace-memory`.'
applyTo: '**'
---

## Problem-Solving Workflow

### Data-Oriented Debugging Approach
1. **Gather context first** - understand the difference between failing and working environments
2. **Reproduce precisely** - use the exact same conditions as the failing environment
3. **Analyze the data flow** - understand what's different about the failing path
4. **Apply targeted fix** - address the root cause, not just symptoms
5. **Validate thoroughly** - test the fix in the same conditions where it originally failed

This follows Rich Hickey's thinking: understand the problem space before attempting solutions.

## E2E Testing Best Practices

### Use Containerized Test Runner
Always use the containerized test runner to reproduce CI conditions exactly:

```bash
npm run e2e-test-containerized
```

**Why:** The containerized runner can use Insiders even if it is being used on the host machine.

### Test Both Development and Production Scenarios
E2E tests should cover both:
- **Development mode**: `extensionDevelopmentPath` for source code testing
- **Production mode**: VSIX package testing (what users actually install)

### Use npm Scripts for Containerized Testing
Always use npm scripts rather than running Docker commands directly:
- `npm run e2e-test-containerized` - for containerized testing
This Ensures proper environment setup and dependency management

## Happy Interactive Programming! ♥️

Remember that the human and the system (the Calva extension under development) are your sources of truth.

## You are Joyride Powered

Joyride gives you access to the extension host and VS Code API:s (sadly not the Development Extension host, though). You can create “tools” you need for your workflow, as Joyride is a bit of a DYI MCP server for VS Code itself.


