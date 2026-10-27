# Calva REPL Input Architecture

How the REPL Input is built, and where to start when you change it. The REPL Input is a CodeMirror 6 editor in the Output views, below the output. The webview holds the text, the selections, the undo history and the completion list, and draws them. What makes it Calva runs in the extension: Paredit, formatting, indentation, rainbow brackets, routing, namespaces, evaluation, history, completion and go to definition.

Read [Output Views Architecture](output-views-architecture.md) first. The REPL Input lives in that page, takes part in its uniflow loop, and talks over the same messages. For routing, see [Session Routing](multi-session-architecture.md#session-routing).

## Status: dark launched

The REPL Input is behind `calva.outputViews.replInput`, a setting with one value per view, `{"output-view": false, "output-sidebar": false}` by default, tagged `experimental`. It has no user documentation and no changelog entry, and stays out of both until it is announced. Keep it that way when you change it.

- The setting alone turns the REPL Input on or off for a view. A change of the setting mounts or unmounts it in the views that are open.
- The REPL Input's keybindings need `calva:replInputFocused`, and its commands in the palette need it or the last focused place (see Focus). Neither can hold without a mounted REPL Input, so with the setting off no key reaches it and none of its commands shows.
- `calva.repl.input.core/init!` runs at every activation, whatever the setting: it loads the history and the kept code, and starts the setting and terminal focus listeners. VS Code's resolved keybindings are read when a REPL Input mounts.

## Three places

| Where | Code | What it owns |
| --- | --- | --- |
| Webview, build `:repl-output-ui` | `src/cljs-lib/src/calva/repl/webview/input/*.cljs` | The CodeMirror state: text, selections, undo history, the completion list. Drawing, highlighting, painting the brackets, which keys to leave to VS Code, walking its copy of the history |
| Extension, cljs-lib | `src/cljs-lib/src/calva/repl/input/*.cljs` | One record per REPL Input, one context both share, focus, the derived data posted to each, history, evaluation, completion and definitions |
| Extension, TS | `src/repl-input.ts` and the modules below | The adapter: functions that call Calva's TS code, passed to cljs-lib at activation. The REPL Input's own commands |

TypeScript keeps what was TypeScript before: Paredit, `StringDocument`, `getIndent`, the formatter, the rainbow painter, the cursor contexts, routing, `getNamespace`, evaluation and the completion and definition providers. The adapter is thin: each of its functions calls existing Calva code.

### Extension side, cljs

The namespaces are `calva.repl.input.<name>`.

| Namespace | What it does |
| --- | --- |
| `core` | `init!`, the setting listener, the terminal focus listener |
| `host` | The state atom, the records, focus, the derived data, the context, posting to the views, the exports TS reads |
| `messages` | Takes the webview's `repl-input-*` messages |
| `records` | The versioned record of each REPL Input, pure |
| `context` | The context, locks and how they route, pure |
| `focus` | The focus decisions, pure |
| `setting` | The setting, pure |
| `config` | Reads the settings, the resolved keybindings, the heights, the stored history and the kept code |
| `command-keys`, `when-clause` | Which keys VS Code gets, from the keybindings and their `when` clauses, pure |
| `brackets` | Which brackets close themselves, and the bracket styles, pure |
| `evaluate`, `evaluations` | Evaluating, stdin, interrupting, and the evaluation bar |
| `history`, `recall` | The history entries, and recalling them |
| `complete`, `completion` | Completion requests, and the copy clojure-lsp completes in |
| `definition`, `reveal` | Go to definition, and the kept code of evaluations |
| `stdin` | stdin for evaluations from files, in an Output view's REPL Input |

### Webview side

The namespaces are `calva.repl.webview.input.<name>`.

| Namespace | What it does |
| --- | --- |
| `editor` | The CodeMirror view: mounting, the compartments that settings reconfigure, the `:repl-input/fx.*` effects, the sash, giving the focus back |
| `actions` | The `:repl-input/ax.*` actions, pure, on the Output view's db |
| `keys` | Which keydowns to leave to VS Code |
| `commands` | CodeMirror's keymap, and the named commands that VS Code's keys run through Calva's keybindings |
| `history` | Walking the history, and the lock or following that a shown entry asks for |
| `context` | The context line: the namespace indicator and its menu, the play button, the evaluation bar |
| `completion` | CodeMirror's completion, fed with the extension's candidates |
| `stdin`, `highlight`, `brackets`, `edit`, `definition`, `tooltip` | The stdin input, highlighting with highlight.js, bracket classes, the smallest text change, click to definition, the controls' tooltips |

### Extension side, TS

| File | What it does |
| --- | --- |
| `src/repl-input.ts` | The adapter (`initReplInput`), following the editor, the `calva.replInput.*` commands, `hasFocus`, `editFocused`, and the wrappers for evaluation commands and custom REPL commands |
| `src/repl-input-document.ts` | `StringDocument` from text and selections and back, new lines with Calva's indentation, the brackets, the cursor contexts |
| `src/repl-input-completion.ts`, `src/repl-input-definition.ts` | The completion and definition parts of the adapter, and the read-only editors of evaluations |
| `src/lsp/repl-input-copy.ts` | The copy that clojure-lsp completes and finds definitions in |
| `src/repl-input-stdin.ts` | Whether an evaluation from a file reads stdin in the Output Sidebar |
| `src/current-file.ts`, `src/current-file-decision.ts` | The current file, which is the REPL Input's source file while it is the current editor |

Calva's TS code that branches on `replInput.hasFocus()`: `src/paredit/extension.ts` (`wrapPareditCommand`, force delete), `src/edit.ts` (`calva.toggleLineComment`), `src/calva-fmt/src/extension.ts` (`calva-fmt.tabDedent`), and `src/extension.ts` (the evaluation commands and custom REPL commands). `src/evaluate.ts` reads the setting for stdin, `src/status.ts` tells the REPL Input when routing changed, and `src/providers/definition.ts` leads to evaluations' code.

## State

On the extension side, `calva.repl.input.host/!state` holds the REPL Inputs' state: the records by view id, the focused and last focused REPL Input, the parsed keybindings, the settings, the context keys last set, the running evaluations, the kept code, the context (`:repl-input.context/lock`, `/editor` and `/line`) and the history (`:repl-input.history/entries` and `/walked`). It changes only in message and event handlers. The decisions are pure functions in their own namespaces, with tests.

Beside it are atoms for things that aren't data: `host/!adapter` (the TS functions), `host/!views` (each view's webview host by id, set when its REPL Input mounts), `evaluate/!running` (each running evaluation's `NReplEvaluation` and stdin resolver), and `complete/!completions` (the request in flight and the JS items each view was answered with).

The view ids are those of the Output Destinations, `"output-view"` and `"output-sidebar"`. Each view has its own record, with its text, selections, version and history position. Both share one context, so a lock made in one view holds in the other.

VS Code keeps the history (`calva.replInput.history`) and the code of the latest 500 evaluations (`calva.replInput.evaluatedCode`) in `workspaceState`, and the dragged heights (`calva.replInput.heights`) in `globalState`.

In the webview, the REPL Input's state is in the Output view's db, under `:repl-input/*` and `:repl-input.history/*`. CodeMirror's `EditorState` holds the text and the undo history.

## Mounting

1. `core/get-webview-html` puts `#repl-input` in every Output view's page, with the data from `host/html-state`: the view id, whether the REPL Input is on, and its stored height.
2. `main.cljs` dispatches `:repl-input/ax.init`. When it is on, `:repl-input/fx.mount` creates the `EditorView`, and `:repl-input/ax.mounted` posts `repl-input-mounted`.
3. `messages/handle-message!` keeps the view in `!views`, makes its record, posts the context line, the history and the evaluation bar, gives the focus to the stdin input when an evaluation waits there, and loads the keybindings, which derives the record (see Editing).

A toggle posts `repl-input-enabled`, which mounts or unmounts the editor in the page as it is. For the Output Sidebar that holds while it is an Output Destination; otherwise `apply-to-output-sidebar!` sets its page again, the help page or the REPL Input alone. Setting the page's HTML again, as the Output Sidebar does when it switches to or from its help page, drops the REPL Input and its text: `host/view-disposed!` forgets the view first.

## Editing

The text goes back and forth with a version:

```clojure
;; webview → extension, after every change to the text or the selections
{:command "repl-input-changed" :repl-input/id "output-view" :version 41
 :text "(foo) bar baz" :selections [[4 4]]}

;; extension → webview, after a Paredit command ran on version 41
{:command/name "repl-input-edit" :repl-input/id "output-view" :repl-input/version 41
 :text "(foo bar) baz" :selections [[4 4]]}
```

- The webview adds one to its version for every change of the text or the selections, and posts `repl-input-changed`.
- `records/take-change` ignores a change older than the record. `records/take-edit` applies an edit only while the record is at the edit's version, and moves the record to the next version, which is what the webview posts once it has applied the edit.
- The webview applies `repl-input-edit` and `repl-input-brackets` only at its current version, and drops them otherwise. It applies the smallest change between its text and the edit's (`edit/text-change`), as one undo step, so the undo history, the decorations and the cursors the edit doesn't move stay.

A key typed while an edit is on its way makes that edit stale, and the webview drops it. This is a known race, kept until it shows in real use.

### How a Calva command edits the REPL Input

1. A keydown reaches CodeMirror. `keys/keydown` matches it against the command keys. When a Calva command owns the key, the editor cancels it with `preventDefault`, and VS Code still resolves its keybinding.
2. VS Code runs the command, like `paredit.slurpSexpForward`, since its `when` clause holds with `calva:replInputFocused`.
3. `wrapPareditCommand` sees `replInput.hasFocus()` and calls `replInput.editFocused` with the command's handler.
4. `host/edit-focused!` makes a `StringDocument` from the record (`repl-input-document.ts`), runs the handler on it, and when the text or selections changed, `take-edit!` posts `repl-input-edit`.
5. `host/derive-record!` derives the cursor contexts, the command keys, the editor settings and the brackets for the new text, sets the cursor contexts while the REPL Input has the focus, and posts what changed.

Every change from the webview derives the record the same way. The brackets come from the rainbow painter Calva paints files with, and the webview paints them by class from a stylesheet with the bracket colors.

The command keys come from `config/read-keybindings+`: VS Code's resolved keybindings, `vscode://defaultsettings/keybindings.json`, which have the keys for the user's keyboard layout, or the manifest's keys for the platform when those can't be read. `command-keys/command-keys` keeps the keys of the bindings whose `when` clause holds in the REPL Input's context: the settings (as `config.*`), `paredit:keyMap`, the cursor contexts, `calva:replInputFocused`, `calva:connected` and `editorHasMultipleSelections`. The keys in `calva.outputViews.replInputCommandKeys` are added, for users' own keybindings.

Keys no Calva command owns stay with CodeMirror: its standard keymap for cursor moves and selections, and the REPL Input's own commands for VS Code's line editing, which `calva.replInput.<name>` runs through `repl-input-run-command` and `commands/by-name`. `calva.replInput.deleteBackward` and `deleteForward` exist because `paredit.deleteBackward` and `paredit.deleteForward` are text editor commands, which don't run without an active text editor.

## Context and routing

The REPL Input evaluates in a context with two layers. The namespace belongs to the code. The REPL that runs it, the session and with it the shadow-cljs build and runtime, is what Calva's router decides, the same way as for everything else. The source file links the two: it is the Clojure file the REPL Input followed when a lock or a history entry was made.

These are the rules a change has to keep:

- A lock and a history entry keep the namespace, the `ns` form and the source file. They keep a session key only when there is no source file, which happens when the code was evaluated before any Clojure editor was followed.
- Each use routes the source file again, so the pinned session, the cljc target and reconnects act on a lock or an entry as they act on the file.
- The REPL Input has no session, build or runtime choice of its own. The pinned session, the cljc target, the runtime picker and the build switch are the controls, for files and the REPL Input alike.

`context/current` works the context out. With a lock, it is the lock. Else it is following the editor: the namespace and `ns` form of the last active Clojure editor at its cursor (`namespace.getNamespace` through the adapter's `editorNamespace`), or `user` before any. The session key is what the adapter's `routedSessionKey` gives for the source file, which is `replSession.getRoutingInfoForUri`: routing by the file's URI, without opening the file. It tries, in order, the pinned session, the REPL window's session for the REPL window's own file, the globs, and the first available session. The cljc target applies to a glob match on the project-fallback tier and to the first available session. When the REPL Input evaluates somewhere unexpected, check for a pin first. The context is connected when a session answers to that key.

The context line, as the views get it, is `(:repl-input.context/line @calva.repl.input.host/!state)`, and the lock is `(:repl-input.context/lock @calva.repl.input.host/!state)`.

- Following: `repl-input.ts` calls `replInputEditorMoved` when the active editor changes, and when its selection changes by keyboard or mouse, for Clojure files other than the REPL window and the read-only editors of evaluations. The REPL window is recognized by its URI, which `repl-window-doc.ts` knows (`_docUri`) only after a connect.
- Routing: `status.update()` calls `replInputRoutingChanged` (`host/routing-changed!`), which works the context out again, routes the history again with `refresh-history!`, and derives the records when the REPL connected or disconnected.
- Locking: after a successful evaluation of code with an `ns` or `in-ns` form (`nsFromText`), `context/lock-after` locks its namespace with the context's source file. The webview asks for a lock or for following the editor with `repl-input-lock` and `repl-input-follow-editor`, from the namespace indicator and the history.
- `host/refresh-context!` posts `repl-input-context` to every view, and routes the history again, when the context line changed. Every change of the lock goes through it.

## Evaluation

1. `alt+enter` runs `calva.replInput.evaluateTopLevelForm`, which picks the top-level form at the cursor. `ctrl+alt+c enter` and the play button evaluate all the text (`calva.replInput.evaluate`, and the webview's `repl-input-evaluate`).
2. `evaluate.cljs` works the context out. Without a connected session, it says so in a message and evaluates nothing.
3. When the code is all of the text, the REPL Input is cleared. The code is added to the history.
4. The evaluation gets an id, `reveal/keep-code!` keeps its code, and the evaluation bar says it runs.
5. The adapter's `evaluate`, `evaluateCode` in `repl-input.ts`, gets the session by its key and calls `evaluate.evaluateInNamespace` around `evaluate.evaluateToOutputDestinations`, the functions evaluations from files use. It evaluates the `ns` form first when the REPL window's namespace differs, and leaves the REPL window's session and namespace where the evaluation ended, as files do. The code is sent with the file name `calva-repl-input/<id>.clj` and the line and column where it starts in the REPL Input, and echoed to the Output Destinations when `calva.evaluationSendCodeToOutputWindow` is on.
6. Results, stdout and errors go to the Output Destinations, like any evaluation's. A REPL Input in a view that isn't an Output Destination shows none of them.
7. When it's done, the context may lock (see Context and routing), and the evaluation bar updates.

The file name matters twice. cider-nrepl's `eval` fails without one, and go to definition finds the evaluation by it (`definition/evaluation-file` and `evaluation-id`).

The other evaluation commands from files work on the REPL Input while it has the focus: `extension.ts` wraps them with `replInput.evaluatingWhenFocused(pick, …)`, which evaluates what `pick` takes from the REPL Input's `StringDocument`. They keep the text and don't add to the history. Custom REPL commands go through `runningSnippetWhenFocused`, with the REPL Input's text and context (`replInputSnippetEvaluation` in `custom-snippets-catalog.ts`).

`calva.replInput.interrupt` interrupts the view's running evaluations, through the `NReplEvaluation` each one handed back when it was sent.

### stdin

- An evaluation from the REPL Input reads stdin in the view's stdin input. `evaluate/read-stdin+` shows it through the evaluation bar, and the webview posts the line with `repl-input-send-line`.
- An evaluation from a file reads stdin in the Output Sidebar's REPL Input while the setting has it on, else in the Output View's while the setting has that on, and otherwise with the input box. Evaluations from the REPL window use the input box. `stdinFor` in `evaluate.ts` picks the view with `stdinViewId` in `repl-input-stdin.ts`, and `calva.repl.input.stdin/read-line+` reveals that view and waits for the line in its stdin input.

## History

- An entry is the code with the context's namespace, `ns` form, source file and session key. `alt+enter` and evaluating all the text add one. The other evaluation commands don't.
- An entry is the same as the last one when the code, the namespace and the source file are the same, and, for an entry without a source file, the session key. Then it isn't added again. This matching is `same-entry?` and `add` in `input/history.cljs`, tested in `test/calva/repl/input/history_test.cljs`.
- `host/refresh-history!` routes each entry's source file again (`history/routed`), keeps the entries of the context's session when `calva.outputViews.replInputHistoryPerSession` is on, and posts `repl-input-history` when the walked entries changed.
- The webview walks its copy, with no round trip: `up` on the first line and `down` on the last, with one cursor and the completion list closed. It keeps the user's own text, and the context line, for walking back past the newest entry.
- A shown entry asks for a mode: following the editor when its namespace and routed session are the editor's, else locked to the entry. The webview posts `repl-input-lock` or `repl-input-follow-editor`, and keeps the mode up to date as the editor changes, until the user picks from the namespace menu, clicks the indicator, evaluates or walks on. This matching is `same-context?` and `entry-mode` in `webview/input/history.cljs`, tested in `test/calva/repl/webview/input/history_test.cljs`.
- `ctrl+r` searches the history in a quick pick (`recall/search-focused!`), and posts `repl-input-recall` with the picked position.

## Completion and go to definition

Completion:

1. CodeMirror's completion asks with `repl-input-complete`: a request id, the text, the offset, and whether it was asked for explicitly.
2. `complete/complete!` cancels the request in flight. Typing asks for candidates only where `editor.quickSuggestions` is on for the place at the cursor: code, a string or a comment, by the cursor contexts.
3. The REPL's candidates come from `providers/repl-completion.ts`, in the context's session and namespace, and clojure-lsp's from a copy. When the REPL answers first, its candidates are posted at once. Then both, merged with `completion-util.mergeCompletions`, the way the completion provider merges them for files.
4. A candidate's docs come with `repl-input-resolve-completion`, and the docs panel shows the arglists and the docstring.
5. `calva:replInputCompletionActive` and `calva:replInputCompletionAcceptsEnter` let the keybindings for `tab` and `enter` step aside while the list is open.

clojure-lsp completes from its own copy of a document, so `lsp/repl-input-copy.ts` sends it one for each request: `.calva/repl-input/repl_input.clj` under the client's workspace folder, which doesn't exist on disk. The copy is the followed file's text and then the REPL Input's text, or, when locked or without a file, the context's `ns` form and then the text (`completion/copy`). A cycle opens it, sends the request, closes it, and says it was deleted, which takes it out of clojure-lsp's analysis. One cycle runs at a time. `lsp/client/client.ts` drops the diagnostics for the copy.

Go to definition, `calva.replInput.revealDefinition` or a click with the modifier `editor.multiCursorModifier` leaves free, asks the providers in the order of `calva.definitionProviderPriority`: the REPL in the context's session (`providers/repl-definition.ts`), and clojure-lsp in the copy. `definition/lsp-target` maps a place in the copy's followed-file part back to the file. A var that the REPL reports in `calva-repl-input/<id>.clj` opens the read-only editor `calva-repl-input:/<id>.clj`, from the kept code, at the definition. Files lead there too, through `src/providers/definition.ts`. Only the latest 500 evaluations keep their code.

## Focus and the last focused place

`calva:replInputFocused` decides where Calva's editing keys go. A stale `true` takes Paredit away from the editor, so every way out of the REPL Input has to reach `host/update-focus!`:

| Event | From |
| --- | --- |
| `:focus`, `:blur` | The webview's `repl-input-focused` and `repl-input-blurred` |
| `:hide`, `:deactivate`, `:dispose`, `:unmount` | The Output View's view state, the Output Sidebar's visibility, a disposed view, an unmounted REPL Input |
| `:text-editor-focus` | `repl-input.ts`: the active editor changes, or its selection changes by keyboard or mouse |
| `:terminal-focus` | `core.cljs`: the active terminal changes |

The command palette takes the focus while the user stays in the REPL Input. So the REPL Input stays the last focused place, `calva:replInputLastFocused`, when it loses the focus, until a text editor or a terminal gets it, or its view goes away (`focus/last-focused-after`). Calva's commands reach the command target: the focused REPL Input, or else the last focused one, which `host/command-target!` gives the focus back. In the webview, `editor.cljs` gives the focus back to the element that had it when the window gets the focus again.

`replInput.hasFocus()` in TS is the export `replInputFocused`, which is true while there is a command target, the last focused place included. When the palette closes and the focus goes back to a file that was already active, VS Code reports no event, so the REPL Input stays the last focused place, and the first Calva editing key in that file goes to the REPL Input. Typing, moving the cursor or clicking in the file ends it.

While the REPL Input has the focus, the cursor contexts (`calva:cursorInComment` and the others) are the REPL Input's, from `cursor-doc/cursor-context.ts`. When it loses the focus, `whenContexts.setCursorContextIfChanged` gives them back to the active editor.

## The REPL Input as the current editor

While the REPL Input is the last focused place, it is the current editor, and Calva's current file is its source file. `currentFileUri()` in `src/current-file.ts` asks `replInputFocused()` and `replInputSourceFile()`, the source file on the context line, and `decideCurrentFileUri` in `current-file-decision.ts`, which is pure and unit tested, gives that file. So routing's default, the status bar, the REPL Sessions menu, the cljc target, and jack-in and connect picking a project root follow the REPL Input. `activeEditorDocument()` leaves it out, for the commands that work on a file's text.

The adapter's `currentFileChanged` calls `status.update()` and `whenContexts.setCurrentEditorContexts`, which sets `calva:ns` to the context's namespace. The host calls it when the REPL Input becomes or stops being the last focused place, and when the context line's source file, session or namespace changes while it is. `status.update()` calls `replInputRoutingChanged`, which refreshes the context. That settles after one round, since the context line is compared before anything is posted. The status bar asks `replSession.getRoutingInfo()` in `statusbar.update`, whose default is the current file.

A lock without a source file has no current file. The status bar then routes without a document, while `alt+enter` uses the lock's session key, and the two can differ.

## Where to start

- A message from the webview: post it from an action with `post` in `webview/input/actions.cljs`, and take it in `input/messages.cljs`.
- A message to the webview: `host/post-to-view!`, a case in `ui/handle-message`, an action in `webview/input/actions.cljs`, and an effect in `editor/exec-effect!` when it changes CodeMirror. `post-to-view!` reaches only the views in `!views`, those with a mounted REPL Input.
- A key: either a CodeMirror keymap in the webview, like the history keys in `editor.cljs`'s `extensions`, or a `calva.replInput.<name>` VS Code command with a keybinding, which runs a command in `commands/by-name` through `repl-input-run-command`. A local keymap needs no round trip, but the user can't rebind it, and it never sees a key that is among the command keys, since those are cancelled before CodeMirror's keymap. A VS Code command follows the user's keybindings and shows in the palette.
- A Calva editing command in the REPL Input: commands that go through `wrapPareditCommand` already work. Others branch on `replInput.hasFocus()` and run on an `EditableDocument` with `replInput.editFocused`.
- A keybinding for an editing or evaluation command: its `when` clause needs `(editorLangId == clojure && editorTextFocus || calva:replInputFocused)`, which `src/extension-test/unit/editing-keybindings-test.ts` checks. A context key the REPL Input's context doesn't have counts as unset, and `when_clause.cljs` reads only the operators Calva's keybindings use today.
- An evaluation command: wrap it in `extension.ts` with `replInput.evaluatingWhenFocused`.
- A TS function that cljs-lib needs: add it to the adapter in `initReplInput`, and to `fake-adapter` in `src/cljs-lib/test/calva/repl/input/host_fixtures.cljs`.
- A cljs-lib function that TS needs: add it to `:exports` in `shadow-cljs.edn`.
- A setting the REPL Input follows: read it in `config/read-settings`, in `clojure-settings` when it can be set per language. `core.cljs` derives the records again when a `calva` setting or one of those changes.

## Known limitations

- An edit from the extension is dropped when a key was typed after the version it was made from (see Editing). `enter` and the clear after `alt+enter` are the likely cases, since a key often follows them at once. F12 reads the text from the extension's record, which can be one change behind.
- After the command palette, the first Calva editing key in the already active file goes to the REPL Input (see Focus).
- From the Output Sidebar, closing the palette, or running a command from it that isn't Paredit's, leaves the focus in the editor area. VS Code gives an extension no event for it.
- The REPL Input doesn't evaluate its `ns` form when the session changes and the REPL window's namespace doesn't, as with a cljc target switch. Files have the same gap.
- A lock without a source file can show another session in the status bar than `alt+enter` uses.
- Before a connect, the REPL window's URI isn't known, so the REPL Input can follow `.calva/repl.calva-repl` as if it were a Clojure file. Seen, not fixed.
- clojure-lsp's copy is always a `.clj` file, so cljs and cljc contexts get clj analysis. Completion doesn't add an alias to the `ns` form, and selects the first candidate whatever `editor.suggestSelection` says. There is no linting.
- Force delete with several cursors does nothing.
- In Cursor, `shift+cmd+l` and `shift+cmd+k` go to Cursor's own commands.
- A webview reload seems to bring the REPL Input up at the height in its first HTML, not the stored one.
- The file evaluation commands' form picks exist twice: `get-text.ts` and `select.ts` keep `vscode` versions of the picks in `util/cursor-get-text.ts`.

## Testing and probing

- The cljs tests: `src/cljs-lib/test/calva/repl/input/` for the extension side and `src/cljs-lib/test/calva/repl/webview/input/` for the webview. `host_fixtures.cljs` has a fake adapter and fake views: a test sends messages to `messages/handle-message!` and reads what was posted. The editor and `main.cljs` have no unit tests, since CodeMirror needs a real document.
- The TS unit tests: `current-file-decision-test.ts`, `repl-input-document-test.ts`, `repl-input-stdin-test.ts` and `editing-keybindings-test.ts` in `src/extension-test/unit/`.
- The e2e suite doesn't drive the REPL Input.
- In the Extension Development Host, turn the REPL Input on with the setting in the test project's `.vscode/settings.json`. The `:calva-lib` runtime has `@calva.repl.input.host/!state`. Each Output view's page is a `:repl-output-ui` runtime, where `@calva.repl.webview.app-db/!app-db` has the REPL Input's db (see Testing and probing in [Output Views Architecture](output-views-architecture.md)).
- Focus events need the window to have the OS focus. When it doesn't, `(calva.repl.input.host/update-focus! [:focus "output-view"])` in the `:calva-lib` runtime stands in for them.
- Keys depend on the keyboard layout, the palette and the OS focus, so key handling needs a check with real keys by a person.
