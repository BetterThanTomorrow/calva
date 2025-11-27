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

### Extension Development and Testing Workflow
The extension uses TypeScript watchers for automatic recompilation during development. Key patterns:

- **Watch tasks handle compilation**: Watchers automatically recompile TypeScript and ClojureScript as files change
- **Human testing required**: Changes to extension logic TypeScript code require manual testing in the Development Extension Host since automated testing cannot access that environment

## Issue Workflow

### Starting Work on an Issue

When beginning work on a GitHub issue, follow this two-step initialization pattern:

1. **Create issue-numbered branch**: Use format `{issue-number}-{descriptive-kebab-case-name}`
   ```bash
   git checkout -b 2929-shadow-cljs-node-browser-repl-builds
   ```

2. **Update changelog immediately**: Add entry to "Unreleased" section using project's established format
   - Use "Fix:" prefix **only for bug fixes** (something broken that now works)
   - Use no prefix for new features, improvements, or enhancements
   - Use the exact GitHub issue title in square brackets
   - Include GitHub issue link
   - Keep it concise but descriptive

Example changelog entries:
```markdown
## [Unreleased]

- Fix: [No `node-repl` and `browser-repl` builds available with **deps.edn + shadow-cljs** project types](https://github.com/BetterThanTomorrow/calva/issues/2929)
- [Add command for selecting shadow-cljs runtime to connect to](https://github.com/BetterThanTomorrow/calva/issues/2923)
```

This workflow ensures:
- Clear traceability between branches and issues
- Immediate documentation of work intent
- Consistent project history and release notes
- Prevents forgotten changelog updates

## Watcher Gate for Clean Edits

### Watcher Gate for Clean Edits

Before modifying any code files (including the extension manifest) in the Calva project, use a subagent inspect all VS Code watchers (TypeScript build, ClojureScript, lint, unit tests, formatter). If any report errors, halt and resolve them together with the user instead of building on a broken state. For unit test watchers, use a subagent to run the full test suite to confirm status. This ensures edits start and end with passing tooling, maintaining honest change sets and preventing compounded fixes.

- **Proactive check**: Treat watchers as gates to avoid coding on failures.
- **Unit test focus**: Immediate full suite run, using a subagent if watcher dies or fails.
- **Outcome**: Clean builds helps with reliable development progress.

## VS Code Task Output Access

When checking output from running VS Code tasks like test watchers or build processes, use the `get_task_output` tool with the task label and workspace folder path. This provides direct access to the task's terminal output, ensuring consistency across platforms and respecting VS Code's architecture.

Example:
```typescript
get_task_output({
  id: "Watch Tests",
  workspaceFolder: "/absolute/path/to/workspace"
})
```

This approach is more reliable than shell commands for extracting output, as it accesses the actual terminal panel content without fragile process parsing or platform-specific dependencies.

## Watcher Output Interpretation

When monitoring automated watchers like lint or test processes, focus on the most recent status by examining the tail of the output. Watch tasks append new statuses at the end, so the latest line reflects the current state—treat earlier entries as historical and obsolete. For example, if the final line reports 'Clean' or 'Passed', the watcher is healthy, preventing unnecessary reruns and aligning with incremental compiler reporting patterns.

## Trust Watcher Results—Don't Duplicate Work

**Critical:** When watchers are running, their output IS the authoritative status. Do not run separate terminal commands to "verify" or "establish a baseline"—the watcher has already done it.

- Test watcher shows "1076 passing" → Tests pass. No need to run `npm test`.
- Lint watcher shows "✓ Clean" → Linting passes. No need to run `npm run lint`.
- TS watcher shows "Found 0 errors" → Compilation passes. No need to run `tsc`.

Running commands separately wastes time and duplicates what watchers continuously do. The watcher output after your changes reflects the current state.