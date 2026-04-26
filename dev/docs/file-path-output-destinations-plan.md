# File Path Output Destinations — Implementation Plan

## Goal

After this plan is complete, Calva users can configure file paths as output destinations in `calva.outputDestinations`. Output written to a file destination is ANSI-stripped and appended to the specified file, which is auto-created (along with parent directories) on first write. The existing four built-in destinations continue to work unchanged. Errors are surfaced once per destination per session via `vscode.window.showErrorMessage` and logged to `console.error` on every occurrence.

## Design Decisions

1. **Path detection**: A string is a file path if it matches `/^([a-zA-Z]:|~|\.{0,2})[/\\]|^[/\\]/` — starts with `./`, `../`, `/`, `\`, `~/`, or a Windows drive letter. Bare strings not matching this pattern are reserved for future enum values.
2. **Nested arrays for path segments**: `["terminal", [".", "logs", "output.txt"]]` — flat arrays are multi-destination, nested `string[]` elements are path segments joined via `path.join`.
3. **Tilde expansion**: `~/` replaced with `os.homedir()`. Only bare `~`, not `~user`.
4. **File/dir creation**: `fs.mkdir(dir, { recursive: true })` then `fs.appendFile`.
5. **Output format**: Same as terminal (includes headers/separators) but ANSI-stripped. For `writeClojure`, pretty-print with `color?: false` to avoid generating ANSI codes that would immediately be stripped.
6. **Error handling**: `vscode.window.showErrorMessage` once per destination string per VS Code session. `console.error` on every occurrence.
7. **Async model**: Fire-and-forget. The `after` callback fires immediately (before the write completes), matching terminal destination behavior.
8. **Workspace root**: Relative paths resolved against first workspace folder (`workspaceFolders[0]`). Multi-root workspaces use the first folder — matches existing `resolveFilePath` usage in Calva.
9. **didLastOutputTerminateLine for files**: Defaults to `true` (correct for fresh files — each write is self-contained).
10. **showResultOutputDestination**: Skip file destinations (no UI to reveal). Opening the file in the editor is a candidate for a follow-up.

## Edge Cases (Analyzed, No Special Code Needed)

- **Concurrent writes**: `fs.appendFile` is atomic at the OS level for writes under PIPE_BUF (~4KB). Sufficient for Clojure output. No write queue.
- **Symlinks**: `fs.appendFile` follows them. Correct behavior.
- **Network drives / slow FS**: Async so non-blocking. Errors caught and reported.
- **Large output**: Files grow unboundedly. Intentional — user controls destination. No rotation.
- **Path traversal**: Not a security concern — user explicitly configures paths in settings.
- **Config hot-reload**: Changing the path mid-session is safe. `getDestinationConfiguration()` reads live config. Stale Map entries are harmless booleans. Error dedup uses raw destination string, so a new path gets fresh error reporting.

---

## Phases

### Phase 1: File Output Writer Module

Create `src/results-output/file-output.ts` as a self-contained module. Zero coupling to `output.ts`. This module handles path detection, resolution, tilde expansion, file writing, and error deduplication.

- [ ] Create `src/results-output/file-output.ts` with:
  - `isFilePathDestination(dest: string): boolean` — regex `/^([a-zA-Z]:|~|\.{0,2})[/\\]|^[/\\]/` positive match
  - `expandTilde(p: string): string` — replaces leading `~/` or `~\` with `os.homedir()` (import `os`)
  - `resolveOutputFilePath(destination: string | string[], workspaceRoot: string | undefined): string | undefined` — calls `expandTilde`, then delegates to `resolveFilePath` from `../util/resolve-file-arg`
  - `appendToOutputFile(resolvedPath: string, text: string): Promise<void>` — `fs.mkdir(dirname, { recursive: true })` then `fs.appendFile(path, text, 'utf-8')`
  - Error deduplication state:
    - `const reportedErrors = new Set<string>()`
    - `reportFileOutputError(destination: string, error: Error, showError: (msg: string) => void): void` — calls `showError` on first occurrence per destination, `console.error` always
    - `resetFileOutputErrors(): void` — for testing
- [ ] Create `src/extension-test/unit/file-output-test.ts` with tests:
  - `isFilePathDestination`: `./foo` ✓, `../foo` ✓, `/abs` ✓, `~/foo` ✓, `C:\foo` ✓, `D:/foo` ✓, `terminal` ✗, `repl-window` ✗, `output-channel` ✗, `output-view` ✗, `some-future-name` ✗, `""` ✗
  - `expandTilde`: `~/logs` → `<homedir>/logs`, `./rel` unchanged, `~user/foo` unchanged
  - `resolveOutputFilePath`: relative resolved against root, absolute as-is, tilde expanded, array segments joined, `undefined` when relative + no root
  - `appendToOutputFile`: creates dir + file (use `os.tmpdir()`), appends to existing file, multiple appends accumulate
  - `reportFileOutputError` / `resetFileOutputErrors`: first error → showError called; second error same dest → showError NOT called; `console.error` called both times; after reset → showError called again
- [ ] No new lint errors
- [ ] Unit tests pass (watcher)

**What the system can do now:** A fully tested file-output module exists but is not wired into the output system. Extension behaves identically.

---

### Phase 2: Widen Types and Normalize Nested Arrays

Update `output-destinations.ts` to accept file path strings and nested path-segment arrays. Update `output.ts` types to accept `string` where they currently accept `OutputDestination`. No behavioral change — file paths pass through the dispatch and silently no-op.

- [ ] In `src/results-output/output-destinations.ts`:
  - Keep `OutputDestination` as the 4-literal union (useful for exhaustive checks on builtins)
  - Change `OutputDestinationValue` to `string | (string | string[])[]` — top-level string = single destination, top-level array = multi-destination with optional nested path-segment arrays
  - Update `normalizeDestinations(value: OutputDestinationValue): string[]`:
    - If not array: wrap in `[value]`
    - If array: map each element — if element is `string[]` (nested), `path.join(...element)`; if string, keep as-is
    - Deduplicate via `Set`
    - Return type is `string[]` (wider than `OutputDestination[]`)
  - Import `path` for joining nested arrays
- [ ] In `src/results-output/output.ts`:
  - Change `AppendOptions.destination` from `OutputDestination` to `string`
  - Convert `didLastOutputTerminateLine` from `Record<OutputDestination, boolean>` to `Map<string, boolean>`, initialized with the 4 builtin keys set to `true`. Access via `map.get(key) ?? true`
  - Convert `lastInfoLineData` from `Record<OutputDestination, AppendClojureOptions>` to `Map<string, AppendClojureOptions>`, initialized with 4 builtin keys. Access via `map.get(key) ?? {}`
  - Update all access sites for both Maps (search exhaustively for `didLastOutputTerminateLine[` and `lastInfoLineData[`)
  - Change `destinationSupportsAnsi` parameter from `OutputDestination` to `string`
- [ ] In `package.json` schema: Update array `items` for each destination property (evalResults, evalOutput, otherOutput) to accept nested `{ "type": "array", "items": { "type": "string" }, "description": "Path segments to join into a file path" }` as an additional `anyOf` option
- [ ] Update unit tests in `src/extension-test/unit/output-destination-test.ts`:
  - `normalizeDestinations('terminal')` → `['terminal']`
  - `normalizeDestinations('./log.txt')` → `['./log.txt']`
  - `normalizeDestinations(['terminal', './log.txt'])` → `['terminal', './log.txt']`
  - `normalizeDestinations(['terminal', ['.', 'logs', 'out.txt']])` → `['terminal', 'logs/out.txt']` (nested array joined)
  - `normalizeDestinations(['terminal', 'terminal'])` → `['terminal']` (dedup)
  - Flat array of segments: `normalizeDestinations(['.', 'logs', 'out.txt'])` → `['.', 'logs', 'out.txt']` (three separate destinations, NOT path segments — only nested arrays are segments)
- [ ] No new lint errors
- [ ] Unit tests pass (watcher)
- [ ] Verify: existing output behavior unchanged (file paths in config silently no-op through write functions)

**What the system can do now:** Types accept file paths, normalization handles nested arrays, but no file I/O occurs. All existing behavior unchanged. Shippable.

---

### Phase 3: Wire File Writing into Output Dispatch

Connect the file-output module to the three write functions. Each gets a single early check: if the destination is a file path, resolve it, write to file, invoke `after` callback, return.

- [ ] In `src/results-output/output.ts`:
  - Import `isFilePathDestination`, `resolveOutputFilePath`, `appendToOutputFile`, `reportFileOutputError` from `./file-output`
  - Add helper in `output.ts`:
    ```typescript
    function writeToFileDestination(destination: string, message: string, after?: AfterAppendCallback): void {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const resolvedPath = resolveOutputFilePath(destination, workspaceRoot);
      if (!resolvedPath) {
        reportFileOutputError(destination, new Error(`Cannot resolve file path: ${destination}`),
          (msg) => vscode.window.showErrorMessage(msg));
        if (after) { after(undefined, undefined); }
        return;
      }
      const stripped = util.stripAnsi(message);
      appendToOutputFile(resolvedPath, stripped).catch((err) => {
        reportFileOutputError(destination, err,
          (msg) => vscode.window.showErrorMessage(msg));
      });
      if (after) { after(undefined, undefined); }
    }
    ```
  - In `writeAppend()`: Add at top, after `didLastOutputTerminateLine` update:
    ```typescript
    if (isFilePathDestination(destination)) {
      writeToFileDestination(destination, message, after);
      return;
    }
    ```
  - In `writeAppendLine()`: Same pattern, append `\n` to message
  - In `writeClojure()`: Add file branch — pretty-print with `color?: false` (no ANSI generation), write via `writeToFileDestination`:
    ```typescript
    if (isFilePathDestination(destination)) {
      const printerOptions = { ...printer.prettyPrintingOptions(), 'color?': false };
      const prettyMessage = printer.prettyPrint(message, printerOptions)?.value || message;
      writeToFileDestination(destination, `${didLastTerminateLine ? '' : '\n'}${prettyMessage}\n`, after);
      return;
    }
    ```
  - In `showResultOutputDestination()`: Skip file destinations (no-op)
  - In `printStackTrace()`: Add file destination handling — write formatted stacktrace via `writeToFileDestination`
- [ ] No new lint errors
- [ ] Unit tests pass (watcher)
- [ ] Create integration test `src/extension-test/integration/suite/file-output-destination-test.ts`:
  - Setup: Create temp output dir via `os.tmpdir()` + unique subfolder. Save/restore `outputDestinations` config (Global scope) in `before`/`after`. Clean up temp dir in `after`.
  - **Test: eval result written to file** — set `evalResults: ['terminal', '<tempdir>/eval-results.txt']`, evaluate `(+ 1 2)`, read file, assert contains `3`, assert no ANSI escape sequences
  - **Test: eval output written to file** — set `evalOutput: '<tempdir>/eval-output.txt'`, evaluate `(println "hello-file-test")`, read file, assert contains `hello-file-test`
  - **Test: file auto-created with parent dirs** — set destination to `<tempdir>/sub/dir/output.txt`, evaluate, assert file exists
  - **Test: nested array path segments** — set destination to `['terminal', ['<tempdir>', 'logs', 'eval.txt']]`, evaluate, assert `<tempdir>/logs/eval.txt` exists with content
  - **Test: tilde expansion** — set destination to `~/calva-test-output-<unique>.txt`, evaluate, assert file at `os.homedir()/calva-test-output-<unique>.txt`, clean up in `after`
  - **Test: multiple appends accumulate** — evaluate twice, read file, assert both results present
  - **Test: existing builtin destinations still work** — set `evalResults: 'repl-window'`, evaluate, assert REPL window contains result (existing pattern from other tests)
  - Use existing patterns: `config.update(..., Global)`, `testUtil.openFile`, `vscode.commands.executeCommand('calva.evaluateSelection')`, small `setTimeout` or poll to allow async file write to complete before reading
- [ ] Integration tests pass: `npm run integration-test -- file-output`

**What the system can do now:** File paths work as output destinations, verified by automated integration tests. Full feature is functional. Shippable.

---

### Phase 4: Documentation

- [ ] Update `calva.outputDestinations` markdownDescription in `package.json` (lines ~168-172): mention file paths, tilde expansion, nested array syntax, path prefix requirements
- [ ] Update `docs/site/output.md`: add section on file path destinations with examples
- [ ] Review `CHANGELOG.md` entry — already present, verify accuracy
- [ ] No new lint errors
- [ ] Unit tests pass (watcher)

**What the system can do now:** Users can discover and correctly use file path destinations through documentation, schema descriptions, and IntelliSense.

---

### Phase 5: Show file destinations in editor

The original Phase 3 implementation skipped file destinations in `showResultOutputDestination`. This was wrong — when the user's first/only `evalResults` destination is a file, the "Show/Open result output destination" command should open that file in the editor.

- [ ] In `src/results-output/output.ts` → `showResultOutputDestination()`:
  - Restore `destinations[0]` as the first destination (remove the `.find` that skips file paths)
  - Add a file-path branch: if the first destination is a file path, resolve it via `resolveOutputFilePath` and open it in the editor via `vscode.window.showTextDocument`
  - Preserve the `preserveFocus` parameter when opening the file
- [ ] Update `docs/site/output.md`: remove the bullet about skipping file destinations
- [ ] No new lint errors
- [ ] Unit tests pass (watcher)

**What the system can do now:** "Show/Open result output destination" opens file destinations in the editor. Shippable.

---

## Open Questions / Assumptions

- `ASSUMPTION:` `util.stripAnsi` in `utilities.ts` is a pure regex with no VS Code dependencies. It can be imported from `file-output.ts` or the stripping can happen in the `writeToFileDestination` helper in `output.ts` (which already has access to `util`). Verify before Phase 3.
- `ASSUMPTION:` `printer.prettyPrint` accepts a `color?` option to disable ANSI color generation. Verify the printer API before Phase 3 implementation.
- `ASSUMPTION:` `fs.appendFile` atomicity is sufficient for Calva's output volume. If users report interleaved output, a per-path write queue can be added without API changes — deferred (YAGNI).
- `ASSUMPTION:` `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath` is the correct way to get workspace root for path resolution. This matches existing Calva patterns.

---

## Original Plan-producing Prompt

```
Create an implementation plan for Calva issue #3185 "Support file paths as output destinations."

Context: Calva is a Clojure IDE extension for VS Code. Issue #2819 added multi-destination
output support — output goes to multiple destinations simultaneously via arrays. Current
built-in destinations: repl-window, output-channel, terminal, output-view.

Issue #3185 extends this by allowing file paths as output destinations — output gets
appended to a file on disk.

Current architecture:
- src/results-output/output-destinations.ts: Pure module (no VS Code deps) with
  OutputDestination type (4-literal union) and normalizeDestinations()
- src/results-output/output.ts: Central output hub with writeAppend/writeAppendLine/
  writeClojure dispatching on destination strings via if-chains. 11 public append
  functions normalize destinations and loop.
- src/util/resolve-file-arg.ts: resolveFilePath(arg, workspaceRoot) handles strings
  (absolute/relative), string arrays (path segments), and URI objects
- package.json schema: anyOf pattern already accepts arbitrary strings alongside
  enum values

Design decisions:
1. Nested arrays for path segments: ["terminal", [".", "logs", "output.txt"]]
2. Path detection regex: ^([a-zA-Z]:|~|\.{0,2})[/\\]|^[/\\] — paths must look like
   paths, bare strings reserved for future enum values
3. Tilde expansion: ~ via os.homedir() (only bare ~, not ~user)
4. Create path + file: fs.mkdir(dir, { recursive: true }) then appendFile
5. File output: terminal format but ANSI-stripped. writeClojure uses color?: false
   to avoid generating ANSI codes that would be stripped
6. Error handling: showErrorMessage once per destination per session, console.error
   every occurrence
7. Fire-and-forget async writes, after callback fires immediately
8. Separate file-output.ts module to preserve output-destinations.ts purity
9. didLastOutputTerminateLine and lastInfoLineData converted from Record to Map
   for dynamic file-path keys

Requirements:
- Bottom-up phase ordering: writer module → types → wire-up → docs
- Each phase must leave the system shippable
- One observable state change per phase
- Concrete checklist items with file paths and line references
- Quality gates in every phase
- Unit tests alongside the behavior they test
- Close with reconstructed original prompt
```
