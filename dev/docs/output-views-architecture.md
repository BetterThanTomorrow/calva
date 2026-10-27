# Calva Output Views Architecture

How the Output View and the Output Sidebar are built, how output gets to them, and where to start when you change them. Together they are the Output views: the Output Destinations `output-view` and `output-sidebar`. Both show the same page, built from the same code. The REPL Input is mounted in that page too, and has a document of its own: [REPL Input Architecture](repl-input-architecture.md).

The Output views are not the REPL window. The REPL window is the `.calva-repl` file ([REPL window](multi-session-architecture.md#repl-window)).

## User facing documentation

* [Output View](../../docs/site/output-view.md)
* [Output destinations](../../docs/site/output.md)

## The pieces

The page runs in a webview, from its own shadow-cljs build. The code that creates the views and talks to them is ClojureScript in cljs-lib, which the extension loads as `out/cljs-lib/cljs-lib.js`. The TypeScript side decides where output goes and calls cljs-lib's exports.

| Where | Code | What it does |
| --- | --- | --- |
| Webview, build `:repl-output-ui` | `src/cljs-lib/src/calva/repl/webview/main.cljs` | The build's `:init-fn`. Starts `ui`, registers the REPL Input's effect handler, mounts the REPL Input |
| | `ui.cljs` | Takes the extension's messages, dispatches actions, runs the effects that draw the DOM, posts to the extension |
| | `app_db.cljs` | The db and `handle-action`, pure: which effects a message or a click leads to |
| | `error_element.cljs`, `stacktrace.cljs` | Errors with their causes and frames. `stacktrace` is pure and is used on the extension side too |
| | `images.cljs`, `image_refs.cljs` | Finds image data URLs, image URLs and image file paths in results |
| | `input/*.cljs` | The REPL Input |
| | `repl-output-ui/css/main.css` | The stylesheet of both views. The build writes `repl-output-ui/js/main.js` |
| Extension, cljs-lib (build `:calva-lib`) | `src/cljs-lib/src/calva/repl/webview/core.cljs` | Creates the Output View panel, builds the page HTML, turns output into messages, posts settings to every view |
| | `sidebar.cljs` | The Output Sidebar's webview view provider, its help page, and the log it replays |
| | `image_host.cljs` | Webview options, local image lookups, fetching remote images for Copy image |
| | `frame_host.cljs` | Opens the file of a clicked stacktrace frame |
| | `token_colors.cljs` | Reads the active color theme's token colors for highlight.js |
| | `greeting.cljs` | The greeting at the top of each view |
| Extension, TS | `src/results-output/output.ts` | Every `append*` function. Picks the destinations from `calva.outputDestinations` and writes to each |
| | `src/results-output/error-output.ts` | Errors with causes, for the Output views and the REPL window |
| | `src/results-output/evaluated-code.ts` | The echo of evaluated code |
| | `src/results-output/output-destinations.ts` | Destination names and normalizing, without `vscode` |
| | `src/results-output/output-sidebar.ts` | Registers the sidebar's provider as `calva.output-sidebar` |
| | `src/extension.ts` | Calls the `init*` exports at activation and registers the commands |

Every function TypeScript calls in cljs-lib is listed under `:exports` in `shadow-cljs.edn`. The TS import of cljs-lib is untyped, so the compiler doesn't catch a misspelled or missing export. The unit test `src/extension-test/unit/cljs-lib-exports-test.ts` does: it fails, naming the file and the name, for each `cljsLib.<name>` in `src/` that isn't an export.

## How output reaches a view

1. Something calls an `append*` function in `output.ts`. Evaluations call it from `evaluate.ts`: results, stdout, stderr and the echoed code. An nREPL session's output outside evaluations comes from `src/nrepl/index.ts`. Connect, jack-in, the test runner and the rest write other output.
2. `output.ts` reads the destinations for the output's category from `calva.outputDestinations` (table below), and emits the message to the `subscribe` listeners once.
3. For a webview destination, `writeToWebview` calls `appendToReplOutputWebview` or `appendToReplOutputSidebar`. An error that comes with causes goes through `error-output.ts` instead (see Errors and stacktraces).
4. In cljs-lib, `core/append` maps the category to a command name with `output-category->command-name`, adds the evaluation's `:meta` (who, namespace, session key, shadow-cljs build and runtime), and posts the message. For the Output View, `ensure-output-view-panel` creates the panel when there is none, so the first output to `output-view` opens it. For the Output Sidebar, `add-output-sidebar-message!` keeps the message in `output-sidebar-log`, and posts it when VS Code has resolved the view.
5. In the webview, `ui/handle-message` reads the message and dispatches `[:msg/output message]`. `app-db/handle-action` returns an `ns-info` effect when the evaluation context differs from the last one, and the effect that appends the output.
6. `ui/exec-effect!` builds the elements, highlights code with highlight.js, and fires `output-appended`, which scrolls to the bottom.

### Output categories

| Category | Written by | Destinations from | Command name | Drawn as |
| --- | --- | --- | --- | --- |
| `evalResults` | `appendClojureEval` | `evalResults` | `show-result` | Highlighted code, with images when it has some |
| `evaluatedCode` | `appendEvaluatedCode` | `evalResults` | `show-evaluated-code` | An "Evaluated code" block |
| `clojure` | `appendClojureOther` | `otherOutput` | `show-result` | Highlighted code |
| `evalOut`, `evalErr` | `appendEvalOut`, `appendEvalErr` and their `appendLine*` | `evalOutput` | `show-stdout` | A `pre` with the category in `data-output-element-type` |
| `otherOut`, `otherErr` | `appendOtherOut`, `appendOtherErr` and their `appendLine*` | `otherOutput` | `show-stdout` | Same as above |

Consecutive `show-stdout` output of the same category goes into the same `pre`. Only `show-stdout` keeps the category in the page: `create-and-append-stdout-element` in `ui.cljs` sets `data-output-element-type`, which the CSS colors by. `message-fxs` in `app_db.cljs` drops the category for `show-result` and `show-evaluated-code`, so those can't be styled per category.

A new category needs:

- `OutputCategory` in `output.ts`.
- The `append*` function in `output.ts` that writes it, and the `calva.outputDestinations` key it reads: an existing one, or a new one in `OutputDestinationConfiguration`, `defaultDestinationConfiguration` and the setting's schema in `package.json`.
- `output-category->command-name` in `core.cljs`. Without it, `core/append` logs an error and the views don't get the output.
- `outputCategoryToApiCategory` in `src/api/repl-v1.ts`. Without it, the API's `onOutputLogged` reports the output as `otherOutput`.
- The CSS, for a `show-stdout` category.

## Messages

Both directions carry Clojure data, in different encodings:

- Extension to webview: an EDN string. `post-message-to-webview` posts `(pr-str message)` and `ui/handle-message` reads it with `cljs.reader/read-string`. The message is a map with `:command/name`, and what it posts has to print as EDN.
- Webview to extension: a JS object with a `command` key. `ui/post-to-host!` converts with `clj->js` and a keyword function that keeps a keyword's namespace, so `:repl-input/id` arrives as `"repl-input/id"`, and `js->clj :keywordize-keys true` turns it back into `:repl-input/id`.

Each view has two message listeners on the extension side: `image-host/listen-for-webview-messages!` for images and stacktrace frames, and `calva.repl.input.messages/listen-for-messages!` for the REPL Input. Each ignores the commands that belong to the other.

| Extension to webview | What it does |
| --- | --- |
| `show-result`, `show-stdout`, `show-evaluated-code` | Output, with `:output`, `:output-category` and `:meta` |
| `show-error`, `show-error-causes` | An error entry, and its causes when they come later |
| `clear-output-view` | Clears the output |
| `set-code-theme` | The highlight.js theme for the theme kind, and the active theme's token colors |
| `set-word-wrap`, `set-image-display` | The view's word wrap and image display |
| `set-base-font-scale`, `adjust-font-size`, `reset-font-size` | The font scale |
| `local-image-resolved`, `local-image-missing`, `image-bytes`, `image-bytes-missing` | Answers to the webview's image requests, by the request's `:id` |
| `repl-input-*` | The REPL Input's messages |

| Webview to extension | What it does |
| --- | --- |
| `resolve-local-image` | Asks for a webview URI for an image file |
| `fetch-image-for-copy` | Asks for a remote image's bytes, for Copy image |
| `open-frame`, `open-java-frame` | Opens a clicked stacktrace frame |
| `repl-input-*` | The REPL Input's messages |

`ui/handle-message` dispatches with a `case`. A command name it doesn't know is logged to the webview's console and ignored. A new message from the extension needs its case there. Most cases dispatch an action in `app_db.cljs`. The answers to image requests call `deliver-host-request!` with no action, and the `repl-input-*` actions are in `webview/input/actions.cljs`.

## The webview's uniflow loop

`ui/dispatch!` takes an action, calls `app-db/handle-action` with the db and the action, and gets back `{:uf/db :uf/fxs :uf/dxs}`. It keeps the new db when it changed, runs each effect with `exec-effect!`, and then dispatches the `:uf/dxs`. Actions don't touch the DOM or post messages; effects do.

- `:msg/*` actions come from the extension's messages.
- `:error/ax.*` actions come from the controls of an error entry.
- `:repl-input/ax.*` actions go to `calva.repl.webview.input.actions/handle-action`.
- `:fx/*` effects run in `ui.cljs`. Effects in another keyword namespace go to the handler registered for it with `register-effect-handler!`. `main.cljs` registers `"repl-input"` for the REPL Input's `:repl-input/fx.*` effects.

The db (`app-db/!app-db`) keeps the last evaluation context (`:output/last-context`, which decides when an `ns-info` line is drawn), the font scale, the error entries by id (`:output/errors`), and the REPL Input's keys. The output itself isn't in the db: the appended elements are the record of it. The image lookups in flight and the results whose raw form is built later are kept in atoms in `ui.cljs`.

`ui.cljs` and `app_db.cljs` are loaded in the Node tests against `src/cljs-lib/test/calva/repl/webview/fake_document.cljs`. CodeMirror needs a real document when it loads, so nothing that requires CodeMirror goes into `ui.cljs`'s requires. The REPL Input's editor is wired in from `main.cljs`.

## The page

`core/get-webview-html` builds the page for both views:

- A Content-Security-Policy with a nonce for the script and the stylesheets. In development (`:is-debug` in `calva.util/env`) it also allows `'unsafe-eval'` and `ws://localhost:*`, which the shadow-cljs devtools need.
- The highlight.js stylesheets from cdnjs, one per color theme kind, with all but the current one disabled, and the copy button plugin's stylesheet from unpkg. Offline, these stylesheets don't load.
- The greeting, `#output`, and the `#repl-input` element with the view id, whether the REPL Input is on for the view, and its stored height.
- The `<html>` element's `--calva-output-font-scale`, the body's `word-wrap` class and `data-image-display` attribute, from the settings when the page is built.

`image-host/webview-options` gives both views scripts, command links to the view's own Show command, and `localResourceRoots`: the extension, workspace folders that aren't `file:`, and the file system roots, so local images anywhere can load. The roots are rebuilt when workspace folders change. Both views keep their page when hidden (`retainContextWhenHidden`).

Setting the HTML again reloads the page and loses what it showed. The Output View sets it once. The Output Sidebar sets it when it switches between its help page and the output, and replays its log after that.

## The two views

| | Output View | Output Sidebar |
| --- | --- | --- |
| VS Code kind | A `WebviewPanel`, `calva.output-view`, in an editor group beside the active one | A `WebviewView`, `calva.output-sidebar`, in the Calva view container |
| Created | In `core/create-repl-output-webview-panel`, at the first output to it, by `calva.showReplOutputView`, or when a `(read-line)` from a file waits in its REPL Input | By VS Code, when the view is shown. `sidebar/create-repl-output-sidebar-provider` resolves it |
| Output before it exists | Creates it | Kept in `output-sidebar-log` and replayed when the view resolves |
| Not an Output Destination | Opens only by the show command, or for a `(read-line)` that waits in its REPL Input | A help page with the current `calva.outputDestinations`, unless the REPL Input is on for it |
| Clear | Posts `clear-output-view` when the panel exists | Empties the log, and posts `clear-output-view` |
| Title buttons | None | Font size, word wrap, image display, and clear |
| Visibility and focus events | `onDidChangeViewState`: visible and active | `onDidChangeVisibility`: visible |
| Title | "REPL" while the REPL Input is on for it, else "REPL Output" | Same |

`output-sidebar-log` keeps what goes through `add-output-sidebar-message!`, output and errors, since the last clear, and only while the sidebar is an Output Destination. Settings, `set-code-theme`, the font size commands and the `repl-input-*` messages are posted to the view directly and aren't replayed. When the sidebar's page is set again, the HTML brings the current word wrap, image display and base font scale, `show-sidebar-output-log!` posts the code theme again, the log is replayed, and the REPL Input mounts again, with its text. The font size adjustments are lost.

## Errors and stacktraces

1. `evaluate.ts` appends a failed evaluation's error with `appendEvalErr`, passing its causes: an array when the debugger already reported them, else a promise of cider-nrepl's `analyze-last-stacktrace` (`src/nrepl/cider.ts`, `Causes`).
2. For an Output view, `error-output.ts`'s `writeErrorToWebview` gives the error an id and calls `appendErrorTo…` with the text and the causes it already has. When the causes are a promise, it calls `attachCausesTo…` with the id when they arrive.
3. `core/error-message` posts `show-error`. In the webview, `stacktrace/error-entry` makes the entry, kept in `:output/errors` by id, and `:fx/render-error` draws it with `error-element/create`. `show-error-causes` updates the entry, and draws it again in place.
4. Unfolding, the frame filters and Copy error are `:error/ax.*` actions that update the entry and draw it again, keeping the focused control. A frame click posts `open-frame` with the file URL, or `open-java-frame` with the class and member, which `frame_host.cljs` looks up through `src/results-output/java-source.ts`.

The text destinations get the whole stacktrace as text after the message (`withStacktraceText` in `output.ts`). The REPL window gets the "Print stacktrace" link (`withStacktraceLink`).

## Images

Images are found in results only (`show-result`), not in stdout.

- `images.cljs` finds base64 image data URLs, replaces each with a `<<image-N TYPE SIZE>>` placeholder, and keeps the raw text for the raw form.
- `image_refs.cljs` finds printed strings that are an image URL, a `file:` URI or an image file path.
- `ui/create-image-element` draws a thumbnail with a Copy image button. A data URL loads at once. A local file waits for `resolve-local-image`, which `image_host.cljs` answers after a stat, with a webview URI. A relative path resolves against the project root of the session that produced the result, through the function `extension.ts` registers with `setSessionProjectRootUriFn`. A remote URL loads only with `images-including-remote-urls`.
- The raw form of a result with images is built when the display first switches to raw.

`calva.outputViewImageDisplay` is the setting. The command `calva.cycleOutputViewImageDisplay` overrides it for the session, cycling between `images` and `raw` only, so remote loading stays on the setting or an explicit command argument. `core.cljs` keeps the override, sets `calva:outputViewImageDisplay`, and posts `set-image-display` to every view.

## Themes, fonts and word wrap

Settings that apply to all views go to every view in `core/registered-webviews`.

- Code colors: `set-code-theme` carries the highlight.js stylesheet for the color theme kind and the token colors that `token_colors.cljs` reads from the active theme's file, with the user's `editor.tokenColorCustomizations`, mapped from highlight.js scopes to Calva's TextMate scopes (`hljs-scope->textmate-scope`). The webview puts the colors in a constructed stylesheet over the highlight.js one. `set-code-theme` is posted when a view is shown or changes view state, when the color theme changes, and when `editor.tokenColorCustomizations` changes. The REPL Input's highlighting uses the same highlight.js classes, so it gets the same colors.
- Font size: the page scales with `--calva-output-font-scale`. `calva.outputViews.fontSizeScale` is the base. The increase, decrease and reset commands adjust each view's db, between 0.5 and 1.5, for as long as the page lives.
- Word wrap: `calva.outputViews.wordWrap`, where `follow-editor` follows `editor.wordWrap`. `calva.toggleReplOutputWordWrap` overrides it for the session and sets `calva:outputWordWrap`. `set-word-wrap` also wraps the REPL Input's lines.

A change to the word wrap or image display setting clears its session override and posts the setting's value to every view.

## Where to start

- A new kind of output in the views: a category (see Output categories), or a new command name with its case in `ui/handle-message`, its `app_db.cljs` action and its `ui.cljs` effect.
- A setting that changes how the views look: read it in `core.cljs`, put its initial value in `get-webview-html`, listen for its change and post to `registered-webviews`, and add an `:msg/*` action and an effect.
- Something the page asks the extension for: post it with `post-to-host!` from an effect, answer it in `image-host/handle-webview-message!` (or a listener of its own, registered with the others in `core/initialize-webview-panel` and the sidebar provider), and reply by the request's `:id` with `deliver-host-request!`, as the image lookups do.
- Something that differs between the views: `core.cljs` for the Output View, `sidebar.cljs` for the Output Sidebar. `set-webview-html!` takes the `:view-kind`. A message for the sidebar goes through `add-output-sidebar-message!` when a page reset should replay it, or straight to `@output-sidebar-webview-view` with `post-message-to-webview` when it shouldn't.

## Testing and probing

- The cljs tests: `src/cljs-lib/test/calva/repl/webview/*_test.cljs`, for the db, the drawing against the fake document, images, image refs, local image lookups, stacktraces, token colors and the sidebar. The `:test` build has `:autorun true`, so in the watch they run on every compile, and the results show in the "Calva Watch CLJS" terminal. Without the watch, `npm run compile-cljs` compiles and `npm run calva-lib-test` runs them. The `:test` build has no REPL runtime.
- The TS unit tests: `src/extension-test/unit/results-output/`, and `output-destination-test.ts` and `file-output-test.ts` in `src/extension-test/unit/`.
- The e2e suite: `src/extension-test/e2e/suite/file-output-destination-test.ts` checks where evaluations write.
- In the Extension Development Host: `src/cljs-lib/fiddles/output_destinations.cljs` reaches the Output View panel, the destinations and the terminals from the `:calva-lib` runtime. `src/cljs-lib/fiddles/output_heartbeat.clj` prints from a background thread once a minute, for output that arrives without an evaluation.
- The REPL: in the source window, connect with the "Calva" connect sequence from `.vscode/settings.json`. It starts the shadow-cljs watches for `:calva-lib`, `:repl-output-ui` and `:test`, and its `cljs` session defaults to `:calva-lib`, which runs in the Extension Development Host's extension host. The `:calva-lib` runtime has `calva.repl.webview.core/registered-webviews` and `calva.repl.webview.sidebar/output-sidebar-log`.
- Several runtimes can be connected to one build: the unit test watcher's mocha worker (Node 22, `calva.util/vscode` nil) loads `:calva-lib` too, and each open Output view is a `:repl-output-ui` runtime of its own. From the `clj` session, `(shadow.cljs.devtools.api/repl-runtimes :repl-output-ui)` lists them. Its `:client-id` is the `:runtime-id` for `(shadow.cljs.devtools.api/cljs-eval :repl-output-ui "@calva.repl.webview.app-db/!app-db" {:runtime-id n})`, which returns the results as strings under `:results`. Tell two views apart by `(:repl-input/id @calva.repl.webview.app-db/!app-db)`.
- The command Developer: Open Webview Developer Tools shows a view's DOM and console.
- Changes to the cljs-lib and `:repl-output-ui` code reload through the shadow-cljs watch. HTML built by `get-webview-html` shows in a view after its page is set again, for example after closing and reopening the Output View. TS changes need a reload of the Extension Development Host.
