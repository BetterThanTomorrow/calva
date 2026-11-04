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
| Webview, build `:repl-output-ui` | `src/cljs-lib/src/calva/repl/webview/main.cljs` | The build's `:init-fn`. Adds the tooltip, starts `ui`, registers the REPL Input's effect handler, posts `page-loaded`, mounts the REPL Input. The build writes `repl-output-ui/js/main.js` |
| | `ui.cljs` | Takes the extension's messages, dispatches actions, runs the effects that draw the DOM, posts to the extension |
| | `app_db.cljs` | The db and `handle-action`, pure: which effects a message or a click leads to |
| | `error_element.cljs`, `stacktrace.cljs` | Errors with their causes and frames. `stacktrace` is pure and is used on the extension side too |
| | `images.cljs`, `image_refs.cljs` | Finds image data URLs, image URLs and image file paths in results |
| | `tooltip.cljs` | The tooltip of every control in the page |
| | `keybindings_note.cljs` | The keybindings note at the end of the greeting, as hiccup |
| | `code_highlight.cljs` | The classes that color code, one per color and font style, in one constructed stylesheet, and code's hiccup and DOM with them. The REPL Input uses them too |
| | `copy_button.cljs` | The copy button, a Replicant alias every block with one uses |
| | `spinner.cljs` | The spinner of a running evaluation, after an evaluated code block's label and on the REPL Input's context line, and removing it when the evaluation ends |
| | `auto_scroll.cljs` | Auto scrolling: whether appended output scrolls the output to its end, and the scroll anchoring that goes with it |
| | `viewport_observer.cljs` | Accessibility support in the page: the output hidden from screen readers while it is off, and while it is on, the output blocks far from the view |
| | `output_cap.cljs` | How much output a page keeps, and which blocks the cap removes. `ui/trim-output!` removes them |
| | `folded_result.cljs` | Folded results: their block, their kept text, and unfolding them |
| | `stdout.cljs` | Stdout's blocks of up to 10,000 characters, and their runs |
| | `throttle.cljs` | `throttle-fn`, for the scrolling and the trim that don't need to run on every append |
| | `folding.cljs` | Which evaluation results show folded, and what a folded result says. The extension uses it too |
| | `input/*.cljs` | The REPL Input |
| | `printed_code/*.cljs` | Printed code's editor, which a click puts in place of a printed code block, for Paredit to move and select in, and to fold |
| | `styles_reload.cljs` | A preload of the build in development: renders the views' styles into the page again after each code reload |
| Extension, cljs-lib (build `:calva-lib`) | `src/cljs-lib/src/calva/repl/webview/core.cljs` | Creates the Output View panel, builds the page as hiccup, posts output and settings to every view |
| | `output_messages.cljs` | The messages for output, errors and printed code's colors, with the output's meta data |
| | `sidebar.cljs` | The Output Sidebar's webview view provider, and its help page (`help-page`) |
| | `output_log.cljs` | The log of the output posted to the Output views, which a view's new page replays |
| | `image_host.cljs` | Webview options, local image lookups, fetching remote images for Copy image |
| | `frame_host.cljs` | Opens the file of a clicked stacktrace frame |
| | `token_colors.cljs` | Reads the active color theme's token colors, font styles and semantic token colors |
| | `code_tokens.cljs` | clojure-lsp's semantic tokens for printed code |
| | `greeting.cljs` | The greeting at the top of each view, ending with the empty place of the keybindings note |
| | `html.cljs` | Renders hiccup to HTML with Replicant |
| | `styles.cljs` | The views' own styles as Garden data, `rules`, and the Output Sidebar help page's, `help-rules`, with `css` and `help-css`, which render them. `rules` puts together, in the order they apply, the rules of `styles/output.cljs`, `images.cljs`, `copy_buttons.cljs`, `repl_input.cljs` and `errors.cljs` |
| | `src/cljs-lib/src/calva/trail.cljs` | The trail: lines for Calva's activation and the Output views, in the console and the Calva Log output channel |
| Extension, TS | `src/results-output/output.ts` | Every `append*` function. Picks the destinations from `calva.outputDestinations` and writes to each |
| | `src/results-output/error-output.ts` | Errors with causes, for the Output views and the REPL window |
| | `src/results-output/evaluated-code.ts` | The echo of evaluated code, dedented from the column the code starts at in its file, and which Output views show the code of each running evaluation, so they hear when it ends |
| | `src/results-output/output-destinations.ts` | Destination names and normalizing, without `vscode` |
| | `src/results-output/output-sidebar.ts` | Registers the sidebar's provider as `calva.output-sidebar` |
| | `src/extension.ts` | Calls the `init*` exports at activation and registers the commands |

Every function TypeScript calls in cljs-lib is listed under `:exports` in `shadow-cljs.edn`. The TS import of cljs-lib is untyped, so the compiler doesn't catch a misspelled or missing export. The unit test `src/extension-test/unit/cljs-lib-exports-test.ts` does: it fails, naming the file and the name, for each `cljsLib.<name>` in `src/` that isn't an export.

## How output reaches a view

1. Something calls an `append*` function in `output.ts`. Evaluations call it from `evaluate.ts`: results, stdout, stderr and the echoed code. An nREPL session's output outside evaluations comes from `src/nrepl/index.ts`. Connect, jack-in, the test runner and the rest write other output.
2. `output.ts` reads the destinations for the output's category from `calva.outputDestinations` (table below), and emits the message to the `subscribe` listeners once.
3. For a webview destination, `writeToWebview` calls `appendToReplOutputWebview` or `appendToReplOutputSidebar`. An error that comes with causes goes through `error-output.ts` instead (see Errors and stacktraces).
4. In cljs-lib, `core/append` maps the category to a command name with `output-category->command-name`, adds the evaluation's `:meta` (who, namespace, session key, shadow-cljs build and runtime), and posts the message. For the Output View, `ensure-output-view-panel` creates the panel when there is none, so the first output to `output-view` opens it. For the Output Sidebar, `add-output-sidebar-message!` keeps the message in the output log, and posts it when VS Code has resolved the view.
5. In the webview, `ui/handle-message` reads the message and dispatches `[:msg/output message]`. `app-db/handle-action` returns an `ns-info` effect when a new evaluation starts (the extension numbers each evaluation, `evaluationId`, which reaches the page as `:meta/evaluation-id`) or the evaluation context differs from the last one, and the effect that appends the output. The text destinations decide their info line the same way, in `src/results-output/info-line.ts`.
6. `ui/exec-effect!` adds the output to the page, colors code (see Printed code), and fires `output-appended`, which scrolls to the bottom while auto scrolling is on (see The page). Each output block is hiccup: the namespace info, evaluated code, results, stdout and results with images from `ns-info-element`, `evaluated-code-element`, `clojure-code-element`, `stdout/element` and `images-form-element`, folded results from `folded-result/element`, and errors from `error-element/element`. `insert-hiccup!` renders a block's hiccup with `html/render`, inserts it with `insertAdjacentHTML`, and returns the inserted element.

### Output categories

| Category | Written by | Destinations from | Command name | Drawn as |
| --- | --- | --- | --- | --- |
| `evalResults` | `appendClojureEval` | `evalResults` | `show-result` | Highlighted code, with images when it has some, folded over `calva.outputViews.foldResultsLongerThan` characters |
| `evaluatedCode` | `appendEvaluatedCode` | `evalResults` | `show-evaluated-code` | An "Evaluated code" block, with a spinner after its label until the evaluation ends |
| `clojure` | `appendClojureOther` | `otherOutput` | `show-result` | Highlighted code |
| `evalOut`, `evalErr` | `appendEvalOut`, `appendEvalErr` and their `appendLine*` | `evalOutput` | `show-stdout` | A `pre` with the category in `data-output-element-type` |
| `otherOut`, `otherErr` | `appendOtherOut`, `appendOtherErr` and their `appendLine*` | `otherOutput` | `show-stdout` | Same as above |

Consecutive `show-stdout` output of the same category goes into the same `pre`, up to 10,000 characters, and continues in new `pre` elements after that (see Keeping the pages light). Only `show-stdout` keeps the category in the page: `stdout-element` in `ui.cljs` sets `data-output-element-type`, which the CSS colors by. `message-fxs` in `app_db.cljs` drops the category for `show-result` and `show-evaluated-code`, so those can't be styled per category.

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

Each view has four message listeners on the extension side: `image-host/listen-for-webview-messages!` for images and stacktrace frames, `calva.repl.input.messages/listen-for-messages!` for the REPL Input, `core/listen-for-page-loaded!` for `page-loaded` and `read-keybindings-again`, and `core/listen-for-highlighting-requests!` for printed code's colors. Each ignores the commands that belong to the others.

| Extension to webview | What it does |
| --- | --- |
| `show-result`, `show-stdout`, `show-evaluated-code` | Output, with `:output`, `:output-category` and `:meta`, and printed code's `:output/highlighting` |
| `show-error`, `show-error-causes` | An error entry, and its causes when they come later |
| `evaluation-ended` | The evaluation `:meta/evaluation-id` ended, which removes the spinner of its evaluated code. `output.endEvaluation` posts it, when an evaluation from a file, the REPL Input or the API ends, to the views that show its code |
| `clear-output-view` | Clears the output |
| `set-code-theme` | The active theme's palette key, which tells when printed code needs coloring again, and its color for function names, which stack frames take |
| `output-highlighting`, `output-semantic-tokens` | Printed code's colors, `[id ranges]` for each code element, from the grammar and from clojure-lsp |
| `keybindings-note` | The keybindings note, `:keybindings-note/custom`: the user's custom keybindings of commands the Output views handle, each with `:reaches-output-views?` and the `when` clause of Calva's own binding of the command. Empty, the note goes away |
| `set-word-wrap`, `set-image-display` | The view's word wrap and image display |
| `set-accessibility-support` | Whether screen readers can read the output, how many lines around the visible output they read, and the note they get when they can't |
| `set-max-output-characters` | The output cap. The page trims to it at once |
| `set-base-font-scale`, `adjust-font-size`, `reset-font-size` | The font scale |
| `scroll-to-end` | Scrolls the output to its end, with auto scrolling on. The command Scroll Output View to End (`calva.scrollOutputViewToEnd`) posts it, with `sidebar/scroll-to-end`, to the view its argument names, an Output Destination id. Without one of the Output views' ids, it asks which view in a quick pick |
| `local-image-resolved`, `local-image-missing`, `image-bytes`, `image-bytes-missing` | Answers to the webview's image requests, by the request's `:id` |
| `repl-input-*` | The REPL Input's messages |

| Webview to extension | What it does |
| --- | --- |
| `resolve-local-image` | Asks for a webview URI for an image file |
| `fetch-image-for-copy` | Asks for a remote image's bytes, for Copy image |
| `open-frame`, `open-java-frame` | Opens a clicked stacktrace frame |
| `output-highlight` | Asks for the grammar's colors of code elements, `[id text]` each |
| `output-semantic-tokens` | Asks for the semantic tokens of code elements, `[id text ns session-key]` each |
| `read-keybindings-again` | The keybindings note's button. The extension reads the keybindings again for the REPL Inputs and printed code, and posts `keybindings-note` to every view |
| `page-loaded` | The page's script has run, before the REPL Input mounts. The extension logs it on the trail, forgets the view's printed code (`printed-code/forget!`), since the page's versions start over, and answers with `repl-input-enabled` for the view, since a page that loads while the setting changes can miss the `repl-input-enabled` that the change posts. It reads the user's keybindings and posts the view `keybindings-note` |
| `repl-input-*` | The REPL Input's messages |

`ui/handle-message` dispatches with a `case`. A command name it doesn't know is logged to the webview's console and ignored. A new message from the extension needs its case there. Most cases dispatch an action in `app_db.cljs`. The answers to image requests call `deliver-host-request!` with no action, and the `repl-input-*` actions are in `webview/input/actions.cljs`.

## The webview's uniflow loop

`ui/dispatch!` takes an action, calls `app-db/handle-action` with the db and the action, and gets back `{:uf/db :uf/fxs :uf/dxs}`. It keeps the new db when it changed, runs each effect with `exec-effect!`, and then dispatches the `:uf/dxs`. Actions don't touch the DOM or post messages; effects do.

- `:msg/*` actions come from the extension's messages.
- `:error/ax.*` actions come from the controls of an error entry.
- `:output/ax.*` actions come from the output blocks' controls: `:output/ax.copy-stdout` from a stdout block's Copy output button, `:output/ax.copy-image` from a thumbnail's Copy image button, and `:output/ax.unfold-result` and `:output/ax.copy-folded-result` from a folded result's buttons. `:output/ax.errors-removed` comes from the output cap's effect instead of a control. A control's actions are EDN in its `data-action` attribute, with `:event/target` standing for the control. `on-output-click`, the one click listener on `#output`, reads the attribute of the nearest element that has one, hides the page's tooltip and dispatches the actions.
- `:repl-input/ax.*` actions go to `calva.repl.webview.input.actions/handle-action`.
- `:fx/*` effects run in `ui.cljs`. Effects in another keyword namespace go to the handler registered for it with `register-effect-handler!`. `main.cljs` registers `"repl-input"` for the REPL Input's `:repl-input/fx.*` effects.

The db (`app-db/!app-db`) keeps the last evaluation context and evaluation (`:output/last-context` and `:output/last-evaluation`, which decide when an `ns-info` line is drawn), the font scale, the error entries by id (`:output/errors`), and the REPL Input's keys. The output itself isn't in the db: the appended elements are the record of it. The image lookups in flight and the results whose raw form is built later are kept in atoms in `ui.cljs`, and the folded results' text, with the result unfolded last, in `folded_result.cljs`.

`ui.cljs` and `app_db.cljs` are loaded in the Node tests against `src/cljs-lib/test/calva/repl/webview/fake_document.cljs`. The fake document can't parse HTML, so the tests that add output replace `ui/insert-hiccup!` with `fake-document/insert-hiccup!`, which builds the fake document's elements from the same hiccup. The output blocks' hiccup is tested as data in `output_blocks_test.cljs`, with `lookup`. CodeMirror needs a real document when it loads, so nothing that requires CodeMirror goes into `ui.cljs`'s requires. The REPL Input's editor is wired in from `main.cljs`.

## Printed code

Results, evaluated code, the code in errors and the completion docs are colored the way files are: Calva's grammar runs in the extension (`calva.repl.input.highlighting`, shared with the REPL Input), and clojure-lsp's semantic tokens go over it.

1. `output-messages/output-message` makes the message that posts printed results and evaluated code with `:output/highlighting`, the grammar's `[from to color styles]`, from `highlighting/printed-highlighting`. Text longer than 50,000 characters gets no ranges and shows plain. A result that will be folded gets none either, and asks for them when it is unfolded. The grammar takes the extension host about 2.7 ms per 1,000 characters. Both views asking for the same text highlight it once.
2. With the ranges come the brackets: `printed-brackets/brackets` paints them with Calva's painter under the `calva.highlight` settings, with misplaced brackets, comment and ignored forms, and the rainbow indent guides, but no active guides, since printed code has no cursor. The page draws code as `pre.output-code-block > code.output-code.clojure-code`, in the editor's colors, with spans classed by `code-highlight` and marked with the bracket classes of `code-brackets` (`code-highlight/segments` lays the marks over the color runs), and the shared copy button. `data-highlighted` says how the code is colored: `grammar`, `plain` (too long), or `uncolored` (the extension couldn't color it).
3. Code without ranges, like an image result's text, its raw form, or an error's data, gets an id and is asked for with `output-highlight`. The extension answers a chunk of about 20,000 characters at a time. The page remembers the ranges of the latest 100 texts, so an error drawn again is colored at once.
4. Code colored by the grammar is then asked for its semantic tokens with `output-semantic-tokens`, a pause after the last, with the namespace and session of the output's latest namespace header. `code-tokens/tokens+` puts the code of each namespace in one clojure-lsp copy, below the namespace's file when it's open, so aliases resolve, else below an `ns` form. The page lays the answer over the grammar's ranges it kept for the code.
5. A theme change asks for the colors of all code colored by the grammar again.

The Output Sidebar's log keeps messages without their highlighting, so a page that shows the log later asks in the colors it has then.

### Printed code's editor

A click in a printed code block puts a read-only CodeMirror editor in its place, so Paredit's navigation and selection commands can move a cursor and selections in it. The page has one at a time.

1. `printed-code.editor/clicked-block` takes the page's selection as offsets in the block's `code` element. A selection that reaches outside the block, as a drag across blocks makes, stays the page's own.
2. The editor goes after the `code` element, which is hidden and keeps getting its colors, so the copy button and late semantic tokens keep working. `printed-code.editor/drawn!` remembers the colors each code element is drawn with (`ui/set-spans!` and `ui/append-code!` call it), for the editor to start with, and colors an open editor anew. It follows the word wrap setting.
3. Escape, from one cursor without a selection, draws the block again and gives the focus to `#output-scroller`. `#output-scroller` has `tabindex="-1"` for it, so the keys that scroll scroll the output, as in a notebook. With a selection or several cursors, Escape first reduces them, as CodeMirror does. Focus moving to another place in the page draws the block again. The window losing the focus keeps the editor, and `input.editor/restore-focus!` gives it the focus back with the window, as it does the REPL Input. Clearing the output removes it. A drag that starts in the open editor selects inside it, since CodeMirror takes the press. A drag across blocks starts outside it.
4. The editor folds. `printed-code.folds` pairs the brackets of `printed-code-brackets`, the painter's `[from to depth]`, into the folds of the forms, from after the open bracket to the close bracket, and `fold-at` gives a line the first form that opens on it and closes on a later one. The editor keeps the folds in a state field, which starts with the outermost form of the text, since the extension sends no brackets for text longer than the printed code that gets colored. CodeMirror's `codeFolding`, `foldGutter` and `foldKeymap` from `@codemirror/language` do the rest. The fold gutter takes the `1em` that the block has on the left, and the editor's lines have no left padding, so the text stays where it was when the editor opens. Each editor starts unfolded.
5. The editor posts `printed-code-focused` (with the text), `printed-code-changed` (the selections), `printed-code-blurred` and `printed-code-unmounted`, at versions that count up for as long as the page lives. Each click opens a new editor, with its own number, which the focus carries. The extension answers with `printed-code-selections`, `printed-code-brackets` (with the matched brackets and active guides at the cursors), `printed-code-command-keys` and `printed-code-focus`. The selections and the brackets carry the editor and the version they were made from, and apply only to that editor at that version, since the extension can answer an earlier editor after a click opened another. The extension side is in [REPL Input Architecture](repl-input-architecture.md), under Printed code.

## The page

`core/page` builds the page for both views as hiccup, and `set-webview-html!` renders it with `html/document`. Replicant writes a double quote as `&#39;`, the entity of an apostrophe, so `html/render` writes those as `&quot;`. HTML parsing turns a carriage return into a line feed, so `html/render` writes carriage returns as `&#13;`, and output keeps them. A VS Code `Uri` goes into the hiccup as a string, since Replicant writes an attribute whose value isn't a string, a number or a keyword as a bare name. The page has:

- A Content-Security-Policy that allows stylesheets from the webview's own source, and a nonce for the script and the styles in the page. In development (`:is-debug` in `calva.util/env`) it also allows `'unsafe-eval'` and `ws://localhost:*`, which the shadow-cljs devtools need.
- The views' styles, `styles/css`, in a `<style id="calva-output-styles">` with the nonce. Saving `styles.cljs` or a namespace under `styles/` in development shows in the open views: `styles_reload.cljs` renders it into that element after the code reloads.
- The greeting, `#output-hidden-note`, the note for screen readers while accessibility support is off, `#output`, with `aria-hidden` while it is off, `#output-end`, an empty element that marks the end of the output (see auto scrolling below), and the `#repl-input` element with the view id, and whether the REPL Input is on for the view. `#output-scroller` points at the note with `aria-describedby`.
- The `<html>` element's `--calva-output-font-scale`, the body's `word-wrap` class and `data-image-display`, `data-accessibility-support`, `data-accessibility-page-size` and `data-max-output-characters` attributes, from the settings when the page is built.

The page draws its controls' tooltips itself, since `title` tooltips are unreliable in webviews. `main` adds one hint popover, `#output-tooltip`, to the body, and `tooltip/attach!` points a control at it with `interestfor`, keeping its text in `aria-description`, which screen readers read as the control's description. A control in hiccup gets the same from `tooltip/attributes`, and `ui/on-output-click` and the REPL Input's Replicant dispatch call `tooltip/hide!` on a click. The tooltip takes that text when the control shows interest, on hover or keyboard focus, `tooltip/refresh!` shows a changed text while it shows, and it hides when its control hides or leaves the page. Every copy button has it, through the `copy-button/button` alias, and so do the error's filter buttons and links and the REPL Input's controls. `interestfor` works on buttons and links only, so an image's label stays its `title`.

`image-host/webview-options` gives both views scripts, command links to the view's own Show command, and `localResourceRoots`: the extension, workspace folders that aren't `file:`, and the file system roots, so local images anywhere can load. The roots are rebuilt when workspace folders change. Both views keep their page when hidden (`retainContextWhenHidden`).

Each page has its own auto scrolling, on when the page loads. While it is on, `output-appended` scrolls the output to its end (`auto-scroll/follow!`). `auto-scroll/listen!` turns it off on a scroll that went up with `#output-end` out of view, and on again on a scroll that ends with `#output-end` in view, or when an `IntersectionObserver` sees it come into view without a scroll. A scroll goes up when it ends above where the user or the page last scrolled to, so the page's own scrolls to the end, between the user's, don't hide a scroll up. `#output-end` lies over the last 4 pixels of the output, so the end counts as in view a little before the very bottom. Output that grows below doesn't scroll, so it doesn't turn auto scrolling off. Turning the REPL Input on or off moves the scrolling between the page and `#output-scroller`, and then the output scrolls to its end with auto scrolling on (`auto-scroll/reveal-end!`). The `scroll-to-end` message does the same. Evaluations from the REPL Input scroll like any other output. While output arrives and the view follows it, the browser's scroll anchoring is off (`auto-scroll/set-anchoring!`, on `#output-scroller` and the document element), until a second after the last `follow!`: blocks above the view change size when they leave the always-laid-out tail of `content-visibility`, and anchoring's adjustment of the scroll position would read as a scroll up. The rest of the time anchoring is on. It keeps the reader's place as the output cap removes blocks from the top, and the view's place when a block at the end unfolds, or a form in printed code's editor folds and unfolds.

Setting the HTML again reloads the page and loses what it showed. The Output View sets it once per panel, and a new panel replays the Output View's part of the output log. The Output Sidebar sets it when it switches between its help page and the output, and replays its log after that.

## Keeping the pages light

A page that keeps every output block grows without limit, and when any app on the machine uses the accessibility API, Chromium keeps a copy of each page's accessibility tree in VS Code's main process and answers the app's text requests there, on the main thread. A full page made the main process grow by gigabytes and stall VS Code on a click in a view (issue [#3336](https://github.com/BetterThanTomorrow/calva/issues/3336)). Five things keep the pages light.

**Output hidden from accessibility.** `calva.outputViews.accessibilitySupport` is `follow-editor` (the default, on when `editor.accessibilitySupport` is `on`; VS Code's `auto` counts as off, since the extension API doesn't say whether VS Code found a screen reader), `on` or `off`. `core/accessibility-support` reads it, with `editor.accessibilityPageSize` and the note, `page` builds them in, and `init-accessibility-support!` posts `set-accessibility-support` to every view when one of them or `editor.accessibilitySupport` changes. Off, `#output` has `aria-hidden="true"`, and `#output-hidden-note`, visually hidden before `#output` until a link in it has the focus, says so and links the setting. While the setting follows `editor.accessibilitySupport` at `auto`, the note also links VS Code's docs on screen reader mode. The webviews allow the command `workbench.action.openSettings` for the setting's link. `#output-scroller` and the REPL Input's editor content point at the note with `aria-describedby`. The body's `data-accessibility-support` says which way it is.

**The viewport observer.** `viewport-observer/set-accessibility-support!` applies the setting in the page. With accessibility support on, `viewport-observer/start!` hides from screen readers the blocks more than `editor.accessibilityPageSize` lines from what shows, as VS Code's editors give screen readers that many lines at once. Blocks start hidden, and an `IntersectionObserver` with a `rootMargin` of that many lines above and below shows the ones near the view. `page-root-margin` measures a line of stdout for it, and a font size change starts the observer again. It is rooted in the element that scrolls: `#output-scroller` while the body has `repl-input-on`, else the document. The implicit root ignores `rootMargin` in the views' iframe. A `MutationObserver` on `#output` observes added blocks and unobserves removed ones, and one on the body's class starts the observer again when the root changes. A block that holds the focus isn't hidden.

**The output cap.** After appends, `trim-output!`, throttled to once every 250 ms, walks the blocks from the newest back, adds up their `textContent`, and removes the blocks older than where the sum passes `calva.outputViews.maxOutputCharacters`, 1,000,000 by default, which the page has in `data-max-output-characters` (`output-cap/current-output-cap`). With 0 it keeps everything. It keeps the newest block and the result unfolded last. For the removed blocks, the focus moves to `#output-scroller` when it was in one, printed code's editor closes (`printed-code.editor/unmount-in!`), the oldest kept block loses `data-continues`, `forget-blocks!` drops their colors, semantic token requests, raw forms, image lookups and folded text, and `:output/ax.errors-removed` drops their errors from the db, so late causes draw nothing. A change of the setting trims at once. The output log keeps its 5,000 messages, so a new page replays them and trims as it goes. Stdout comes in `pre` elements of up to 10,000 characters (`stdout-chunk-size`), filled a whole line at a time, with a line longer than that cut at 10,000 characters, so the cap can remove a long run a piece at a time. A `pre` that continues a run has `data-continues` and no margin to the one before, and every Copy output in a run copies the whole run.

**Folded results.** `folding/folded?` says which evaluation results, `evalResults`, show folded: longer than `calva.outputViews.foldResultsLongerThan` characters, 5000 by default, and none with 0. The extension decides when it makes the message (`output-messages/output-message`), marks it `:output/folded?` and leaves out its highlighting, so a replay folds what was folded when it was printed. `result-fxs` sends a marked result to `folded-result/append!`, which draws one line, `pre.output-folded-result`: an Unfold result button, the start of the first line, the size ("52,341 characters, 1,500 lines"), and Copy. `folded_result.cljs` keeps the text, with the namespace and session of the output's latest namespace header. Unfold result draws the result with `clojure-code-element` in its place, gives its code that namespace and session, and asks for its colors like any code without them. Copy copies the kept text. Results with images, and the `clojure` category, aren't folded.

**`content-visibility`.** The output blocks have `content-visibility: auto`, with `contain-intrinsic-size: auto 200px`, and the last ten `visible`, so a full relayout skips what is out of view, and the end is laid out for auto scrolling. On a page at the cap with large colored results, a relayout went from about 200 ms to 11 ms.

## The two views

| | Output View | Output Sidebar |
| --- | --- | --- |
| VS Code kind | A `WebviewPanel`, `calva.output-view`, in an editor group beside the active one | A `WebviewView`, `calva.output-sidebar`, in the Calva view container |
| Created | In `core/create-repl-output-webview-panel`, at the first output to it, by `calva.showReplOutputView`, or when a `(read-line)` from a file waits in its REPL Input | By VS Code, when the view is shown. `sidebar/create-repl-output-sidebar-provider` resolves it |
| Output before it exists | Creates it, and replays the output log before the new output | Kept in the output log and replayed when the view resolves |
| Opened again after it was closed | Replays the output log | Replays the output log |
| Not an Output Destination | Opens only by the show command, or for a `(read-line)` that waits in its REPL Input | A help page with the current `calva.outputDestinations`, unless the REPL Input is on for it |
| Clear | Takes the view off the log, and posts `clear-output-view` when the panel exists | Takes the view off the log, and posts `clear-output-view` |
| Title buttons | None | Font size, word wrap, image display, and clear |
| Visibility and focus events | `onDidChangeViewState`: visible and active | `onDidChangeVisibility`: visible |
| Title | "REPL" while the REPL Input is on for it, else "REPL Output" | Same |

The output log, `output-log/!log`, keeps the output, errors, causes and `evaluation-ended` messages posted to each view since its last clear. `core/append`, `append-error`, `attach-error-causes` and `end-evaluation` log for the Output View, also while it is closed, and `add-output-sidebar-message!` logs for the Output Sidebar while it is an Output Destination. Each entry is a message and the Output views it went to. A message that is the same as the last entry's, which hasn't gone to the view yet, adds the view to that entry, so output that goes to both views is kept once. Clearing a view takes it off every entry and drops the entries no view has left. The log keeps the latest 5000 entries (`kept-count`), in a queue that drops the oldest, with the last entry kept apart so a view can be added to it without walking the queue. Settings, `set-code-theme`, the font size commands and the `repl-input-*` messages are posted to the view directly and aren't replayed. `ensure-output-view-panel` replays the Output View's messages in a new panel after its code theme, and before the output that created it. When the sidebar's page is set again, the HTML brings the current word wrap, image display and base font scale, `show-sidebar-output-log!` posts the code theme again, the log is replayed, and the REPL Input mounts again, with its text. The font size adjustments are lost. In both views, what only the page kept is lost too: which errors were unfolded, printed code's editor and its folds, and where the view was scrolled to. A replay of a full log of 5000 messages shows in a new Output View within about 1.6 seconds of the show command.

## Errors and stacktraces

1. `evaluate.ts` appends a failed evaluation's error with `appendEvalErr`, passing its causes: an array when the debugger already reported them, else a promise of cider-nrepl's `analyze-last-stacktrace` (`src/nrepl/cider.ts`, `Causes`). cider-nrepl reads the session's `*e` when it handles that request, on a thread of its own, so the session's next evaluations wait until the request is answered, for a second at most (`NReplSession.holdEvaluationsUntil` and `whenCausesAnswered`). Otherwise an evaluation that fails in between gives the error its causes. An evaluation sent before the error came can still change `*e` first. A shadow-cljs evaluation that throws has the value `:repl/exception!` and its error comes as stderr, and cider-nrepl has no causes for it. Then `cljs-error-causes.ts`'s `errorCauses` evaluates its `causesCode`, which prints the causes of the runtime's `*e`, with their ex-data, 50 items per collection and 10 levels deep at most, and without frames. It doesn't throw, and it leaves `*1`, `*2` and `*3` as they were. shadow-cljs doesn't always run a session's evaluations in the order they are sent, so the next evaluations wait for it the same way.
2. For an Output view, `error-output.ts`'s `writeErrorToWebview` gives the error an id and calls `appendErrorTo…` with the text and the causes it already has. When the causes are a promise, it calls `attachCausesTo…` with the id when they arrive.
3. `output-messages/error-message` makes the `show-error` message, with each cause's ex-data pretty-printed by zprint as wide as `calva.prettyPrintingOptions` says, its maps in the order they were printed, when it is 10,000 characters or shorter. Both views get the causes of the same error, which are formatted once. In the webview, `stacktrace/error-entry` makes the entry, kept in `:output/errors` by id, and `:fx/render-error` draws it from `error-element/element`, its hiccup. `show-error-causes` updates the entry, and draws it again in place: the new element is inserted after the earlier one, which is then removed.
4. An error unfolds when its causes have frames or ex-data (`stacktrace/unfoldable?`). A cause's ex-data is printed code (`pre.output-code-block.output-error-data`), colored like results, with a copy button, and a click opens printed code's editor in it. A cause without frames has its heading without a chevron, and an error without frames has no frame filters.
5. Unfolding, the frame filters and Copy error are `:error/ax.*` actions, in the controls' `data-action`, that update the entry and draw it again, keeping the focused control. The rows that unfold, and the frames and the location that open, have `data-plain-click`, so a click that ends a text selection in them does nothing. A frame click posts `open-frame` with the file URL, or `open-java-frame` with the class and member, which `frame_host.cljs` looks up through `src/results-output/java-source.ts`.

The text destinations get the whole stacktrace as text after the message (`withStacktraceText` in `output.ts`). The REPL window gets the "Print stacktrace" link (`withStacktraceLink`).

## Images

Images are found in results only (`show-result`), not in stdout.

- `images.cljs` finds base64 image data URLs, replaces each with a `<<image-N TYPE SIZE>>` placeholder, and keeps the raw text for the raw form.
- `image_refs.cljs` finds printed strings that are an image URL, a `file:` URI or an image file path.
- `ui/image-element` returns the hiccup of a thumbnail with a Copy image button, and `images-form-element` places the thumbnails below the lines they're on. A thumbnail is `data-pending` until its image loads, and an image that can't be shown removes its thumbnail: `on-image-load` and `on-image-error` get the images' `load` and `error` events, which don't bubble, on `#output` in the capture phase. A data URL loads at once. A local file has its path in `data-local-src` and waits for `resolve-local-image`, which `image_host.cljs` answers after a stat, with a webview URI. A relative path resolves against the project root of the session that produced the result, through the function `extension.ts` registers with `setSessionProjectRootUriFn`. A remote URL is in `data-remote-src`, and becomes the `src` only with `images-including-remote-urls`. The Copy image button's action, `:output/ax.copy-image`, carries the image's type, kind and source, and the effect reads a data URL from the thumbnail's `src`.
- The raw form of a result with images is added when the display first switches to raw.

`calva.outputViewImageDisplay` is the setting. The command `calva.cycleOutputViewImageDisplay` overrides it for the session, cycling from `images` to `images-including-remote-urls` to `raw`, or setting the mode it gets as an argument. `core.cljs` keeps the override, sets `calva:outputViewImageDisplay`, and posts `set-image-display` to every view.

## Themes, fonts and word wrap

Settings that apply to all views go to every view in `core/registered-webviews`.

- Code colors: printed code is colored by the extension (see Printed code). `set-code-theme` also carries the bracket styles from the `calva.highlight` settings, which the page installs as the bracket stylesheet. `set-code-theme` is posted when a view is shown or changes view state, when the color theme changes, and when `editor.tokenColorCustomizations` changes. When its palette key differs from the one the page had, the page asks for its code's colors again.
- Font size: the page scales with `--calva-output-font-scale`. `calva.outputViews.fontSizeScale` is the base. The increase, decrease and reset commands adjust each view's db, between 0.5 and 1.5, for as long as the page lives.
- Word wrap: `calva.outputViews.wordWrap`, where `follow-editor` follows `editor.wordWrap`. `calva.toggleReplOutputWordWrap` overrides it for the session and sets `calva:outputWordWrap`. `set-word-wrap` also wraps the REPL Input's lines.

A change to the word wrap or image display setting clears its session override and posts the setting's value to every view.

## Where to start

- A new kind of output in the views: a category (see Output categories), or a new command name with its case in `ui/handle-message`, its `app_db.cljs` action and its `ui.cljs` effect.
- A setting that changes how the views look: read it in `core.cljs`, put its initial value in `page`, listen for its change and post to `registered-webviews`, and add an `:msg/*` action and an effect.
- Something the page asks the extension for: post it with `post-to-host!` from an effect, answer it in `image-host/handle-webview-message!` (or a listener of its own, registered with the others in `core/initialize-webview-panel` and the sidebar provider), and reply by the request's `:id` with `deliver-host-request!`, as the image lookups do.
- State the page keeps for an output block: drop it in `forget-blocks!` too, or the output cap leaves it behind for the blocks it removes, and reset it in `clear-output-dom`.
- Something that differs between the views: `core.cljs` for the Output View, `sidebar.cljs` for the Output Sidebar. `set-webview-html!` takes the `:view-kind`. A message for the sidebar goes through `add-output-sidebar-message!` when a page reset should replay it, or straight to `@output-sidebar-webview-view` with `post-message-to-webview` when it shouldn't.

## Testing and probing

- The cljs tests: `src/cljs-lib/test/calva/repl/webview/*_test.cljs`, for the db, the drawing against the fake document, images, image refs, local image lookups, stacktraces, token colors and the sidebar. The `:test` build has `:autorun true`, so in the watch they run on every compile, and the results show in the "Calva Watch CLJS" terminal. Without the watch, `npm run compile-cljs` compiles and `npm run calva-lib-test` runs them. The `:test` build has no REPL runtime.
- The TS unit tests: `src/extension-test/unit/results-output/`, and `output-destination-test.ts` and `file-output-test.ts` in `src/extension-test/unit/`.
- The e2e suite: `src/extension-test/e2e/suite/file-output-destination-test.ts` checks where evaluations write.
- In the Extension Development Host: `src/cljs-lib/fiddles/output_destinations.cljs` reaches the Output View panel, the destinations and the terminals from the `:calva-lib` runtime. `src/cljs-lib/fiddles/output_heartbeat.clj` prints from a background thread once a minute, for output that arrives without an evaluation.
- The REPL: in the source window, connect with the "Calva" connect sequence from `.vscode/settings.json`. It starts the shadow-cljs watches for `:calva-lib`, `:repl-output-ui` and `:test`, and its `cljs` session defaults to `:calva-lib`, which runs in the Extension Development Host's extension host. The `:calva-lib` runtime has `calva.repl.webview.core/registered-webviews` and `calva.repl.webview.output-log/!log`.
- Several runtimes can be connected to one build: the unit test watcher's mocha worker (Node 22, `calva.util/vscode` nil) loads `:calva-lib` too, and each open Output view is a `:repl-output-ui` runtime of its own. From the `clj` session, `(shadow.cljs.devtools.api/repl-runtimes :repl-output-ui)` lists them. Its `:client-id` is the `:runtime-id` for `(shadow.cljs.devtools.api/cljs-eval :repl-output-ui "@calva.repl.webview.app-db/!app-db" {:runtime-id n})`, which returns the results as strings under `:results`. Tell two views apart by `(:repl-input/id @calva.repl.webview.app-db/!app-db)`.
- `src/cljs-lib/fiddles/output_views_checks.clj`, from the `clj` session, posts a fixed set of output to a view and reads the view's own stylesheet rules and its DOM as data, to compare with the baselines it saved. It also times appending output.
- The command Developer: Open Webview Developer Tools shows a view's DOM and console.
- The trail: `calva.trail/log!` logs a line with the milliseconds since cljs-lib loaded, to the console as `[Calva +<ms>ms] <message>`, and to the Calva Log output channel, a log channel that VS Code also writes to `Calva Log.log` in Calva's extension log folder. It logs activation START and END, each view created or resolved with the REPL Input on or off, its page loaded, or the sidebar's help page set, which has no script, the REPL Input mounted in it, and a changed REPL Input setting. The console lines show in the Debug Console of the window that launched the Extension Development Host, and in the smoke tests' CI log, which tells whether a view's page loaded and its REPL Input mounted. The `:test` build turns the trail off with the closure define `calva.trail/enabled?`.
- Changes to the cljs-lib and `:repl-output-ui` code reload through the shadow-cljs watch. The page built by `page` shows in a view after its page is set again, for example after closing and reopening the Output View. TS changes need a reload of the Extension Development Host.
