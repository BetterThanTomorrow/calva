# Change Log
Changes to Calva.

## [Unreleased]
- [calva.evalCurrentTopLevelFormInREPLWindow fails in specific condition](https://github.com/BetterThanTomorrow/calva/issues/374)

## [2.0.47] - 10.10.2019
- [Fix dimming out of stacked ignored forms](https://github.com/BetterThanTomorrow/calva/issues/385)
- [The extension should specify the default schemes for document selectors](https://github.com/BetterThanTomorrow/calva/issues/368)
- [Make code more robust in case Jack-in task fails](https://github.com/BetterThanTomorrow/calva/issues/367)
- [Support Jack-in without file open for single-rooted workspace](https://github.com/BetterThanTomorrow/calva/issues/366)
- [Show argument list of fn](https://github.com/BetterThanTomorrow/calva/issues/238)

## [2.0.46] - 08.10.2019
- [Connect warnings and errors as popups](https://github.com/BetterThanTomorrow/calva/issues/356)
- [Don't remove default indents when Calva is not the auto-formatter](https://github.com/BetterThanTomorrow/calva/pull/383)

## [2.0.44] - 05.10.2019
- [Support for custom project/workflow commands](https://github.com/BetterThanTomorrow/calva/issues/281)

## [2.0.43] - 03.10.2019
- [Insourcing @tonsky's Clojue Warrior, now named Calva Highlight](https://github.com/BetterThanTomorrow/calva/pull/362)
- [Update status bar when configuration changed](https://github.com/BetterThanTomorrow/calva/issues/358)

## [2.0.42] - 29.09.2019
- [Adding selected calva commands to the editors context menu](https://github.com/BetterThanTomorrow/calva/issues/338)
- [Fix bug with painting all existing result decoration with the same status](https://github.com/BetterThanTomorrow/calva/issues/353)
- [Fix bug with reporting errors using off-by-one line and column numbers](https://github.com/BetterThanTomorrow/calva/issues/354)

## [2.0.41] - 28.09.2019
- [Add pretty print mode](https://github.com/BetterThanTomorrow/calva/issues/327)
- [Add command for evaluating top level form as comment](https://github.com/BetterThanTomorrow/calva/issues/349)
- [Stop writing results from **Evaluate to Comment** to output pane](https://github.com/BetterThanTomorrow/calva/issues/347)

## [2.0.40] - 25.09.2019
- [Add command for connecting to a non-project REPL](https://github.com/BetterThanTomorrow/calva/issues/328)
- [Add hover to inline result display, containing the full results](https://github.com/BetterThanTomorrow/calva/pull/336)
- [Better inline evaluation error reports with file context](https://github.com/BetterThanTomorrow/calva/issues/329)
- [Enhancement REPL window handling / nREPL menu button](https://github.com/BetterThanTomorrow/calva/issues/337)
- [Print async output, and a setting for where it should go](https://github.com/BetterThanTomorrow/calva/issues/218)
- [Fix REPL window prompt does not always reflect current ns](https://github.com/BetterThanTomorrow/calva/issues/280)
- [Escape HTML in stdout and stderr in REPL window](https://github.com/BetterThanTomorrow/calva/issues/321)
- [Add content security policy to webview and remove image load error](https://github.com/BetterThanTomorrow/calva/issues/341)

## [2.0.39] - 20.09.2019
- [Revert disconnecting and jacking out on closing of REPL window](https://github.com/BetterThanTomorrow/calva/issues/326)

## [2.0.38] - 14.09.2019
- [Close java processes when clsoing or reloading VS Code. (Windows)](https://github.com/BetterThanTomorrow/calva/issues/305)

## [2.0.37] - 14.09.2019
- [Support connecting to Leiningen and CLI project using shadow-cljs watcher](https://github.com/BetterThanTomorrow/calva/issues/314)
- Fix [Figwheel Main deps added to non-cljs projects](https://github.com/BetterThanTomorrow/calva/issues/317)

## [2.0.36] - 12.09.2019
- Fix [REPL Window namespace being reset to user](https://github.com/BetterThanTomorrow/calva/issues/302)
- Update nrepl-version to 0.22.1

## [2.0.35] - 10.09.2019
- [Customizing the REPL connect sequence](https://github.com/BetterThanTomorrow/calva/issues/282)
- [Support for launching with user aliases/profiles](https://github.com/BetterThanTomorrow/calva/issues/288)

## [2.0.34] - 04.09.2019
- More accurate code completion lookups.
- [Keep focus in editor when evaluating to the REPL Window](https://github.com/BetterThanTomorrow/calva/issues/229).

## [2.0.33] - 17.08.2019
- Support for starting leiningen and clj projects with aliases.

## [2.0.31] - 13.08.2019
- Support Jack-in and Connect in multi-project workspaces.
- Fix bug with snippet field navigation not working.

## [2.0.30] - 04.08.2019
- nREPL status bar indicator can now be styled

## [2.0.29] - 04.08.2019
- Fix jack-in command quoting for `zsh`.

## [2.0.28] - 01.08.2019
- Jack in quoting fixes, mainly for Windows with `clojure/clj`.
- Fix formatting bug when forms not separated by whitespace.

## [2.0.25] - 12.07.2019
- Add command for running test under cursor (at point in CIDER lingo).

## [2.0.24] - 12.07.2019
- Add ParEdit `forwardUpSexp`.

## [2.0.20] - 20.06.2019
- Improve custom CLJS REPL.

## [1.3.x -> 2.0.20] - -> 06.2019
... huge gap in the Changelog. Sorry about that, but now we have decided to pick up maintaining this log again.

## [1.3.0] - 16.04.2018
- Add support for [shadow-cljs](http://shadow-cljs.org). Please contact me with any information on how this is working for you out there.

## [1.2.14] - 06.04.2018
- Change all keyboard shortcuts to use prefix `ctrl+alt+v`, due to old prefix not working on some alterate keybpard layouts. See [Issue #9](https://github.com/PEZ/clojure4vscode/issues/9).

## [1.2.12] - 06.04.2018
- Add command for re-running previously failing tests (`ctrl+alt+v ctrl+t`). 

## [1.2.10] - 03.04.2018
- Add command for toggling automatic adjustment of indentation for new lines (`ctrl+alt+v tab`)

## [1.2.8] - 02.04.2018
- Auto adjust indent more close to this Clojure Style Guide: https://github.com/bbatsov/clojure-style-guide

## [1.2.1] - 28.03.2018
- Select current (auto-detected) form

## [1.2.0] - 28.03.2018
- Terminal REPLs
  - Integrates REPL sessions from the Terminal tab and lets you do stuff like load current namespace ad evaluate code from the editor in the REPL.
- Connection and reconnection stabilization
  - Conecting the editor REPLs was a bit unstable. Now more stable (but there are still some quirks).

## [1.1.20] - 25.03.2018
- Auto detection of forms to evaluate now condiders reader macro characters prepending the forms. E.g. before if you tried to evaluate say `#{:a :b :c}` with the cursor placed directly adjacent to the starting or ending curly braces only `{:a :b :c}` would be autodetected and evaluated.
- Highlighting of auto detected forms being evaluated.
- Rendering evaluation errors in the editor the same way as successful (but in red to quickly indicate that the evaluation errored).

![Evaluation demo](/assets/howto/evaluate.gif)

## [1.1.15] - 20.03.2018
- Evaluates vectors and maps with the same ”smart” selection as for lists.

## [1.1.11] - 20.03.2018
- Add inline annotations for interactive code evaluation results.

## [1.1.9] - 18.03.2018
- Add toggle for switching which repl connection is used for `cljc` files, `clj` or `cljs`.

![CLJC repl switching](/assets/howto/cljc-clj-cljs.gif)

- `clj` repl connected to all file types, meaning you can evaluate clojure code in, say, Markdown files.


## [1,1.3] - 17.03.2018
- User setting to evaluate namespace on save/open file (defaults to **on**)

## [1.1.1] - 16.03.2018
- Relase of v1, based on **visual:clojure** v2.0, adding:
    - Running tests through the REPL connection, and mark them in the Problems tab
        - Run namespace tests: `ctrl+alt+v t`
        - Run all tests: `ctrl+alt+v a`
    - Evaluate code and replace it in the editor, inline: `ctrl+alt+v e`
    - Error message when evaluation fails
    - Pretty printing evaluation resuls: `ctrl+alt+v p`
    - Support for `cljc` files (this was supposed to be supported by the original extension, but bug)

