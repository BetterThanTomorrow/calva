---
description: 'E2E testing patterns and best practices for Calva extension development.'
applyTo: '**/src/extension-test/e2e,package.json'
---

# E2E Testing Memory

Patterns for reliable end-to-end testing and debugging workflows.

## Use Containerized Test Runner
Always use the containerized test runner to reproduce CI conditions exactly:

```bash
npm run e2e-test-containerized
```

**Why:** The containerized runner can use Insiders even if it is being used on the host machine.

## Test Both Development and Production Scenarios
E2E tests should cover both:
- **Development mode**: `extensionDevelopmentPath` for source code testing
- **Production mode**: VSIX package testing (what users actually install)

## Use npm Scripts for Containerized Testing
Always use npm scripts rather than running Docker commands directly:
- `npm run e2e-test-containerized` - for containerized testing

This ensures proper environment setup and dependency management.

## Environment Variable Debugging
When debugging CI failures related to environment variables:
- Use exact CI argument reproduction: `npm run e2e-test-containerized -- --ci`
- Check JavaScript variable access syntax: `process.env.VARIABLE_NAME` not `process.env[VARIABLE_NAME]`
- Verify variable scoping in launch scripts

## Data-Oriented E2E Debugging
Follow the general debugging workflow for E2E issues:
1. **Gather context** - understand CI vs local environment differences
2. **Reproduce precisely** - use containerized runner with exact CI conditions
3. **Analyze data flow** - trace through launch.js and test setup
4. **Apply targeted fix** - address root cause in environment/configuration
5. **Validate thoroughly** - test with both development and CI scenarios