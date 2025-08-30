---
description: 'A memory for the AI agent working in this project. See also the prompt `add-workspace-memory`.'
applyTo: '**'
---

# Lessons learned and Best Practices for working with Calva


## Problem-Solving Workflow

### Data-Oriented Debugging Approach
1. **Gather context first** - understand the difference between failing and working environments
2. **Reproduce precisely** - use the exact same conditions as the failing environment
3. **Analyze the data flow** - understand what's different about the failing path
4. **Apply targeted fix** - address the root cause, not just symptoms
5. **Validate thoroughly** - test the fix in the same conditions where it originally failed

This follows Rich Hickey's thinking: understand the problem space before attempting solutions.

## Development Environment

### Interactive Programming Philosophy
Remember that the human and the system (the Calva extension under development) are your sources of truth.

### Joyride Integration
Joyride gives you access to the extension host and VS Code APIs (sadly not the Development Extension host, though). You can create "tools" you need for your workflow, as Joyride is a bit of a DIY MCP server for VS Code itself.



