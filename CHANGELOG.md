# Change Log
Changes to Calva. 

## [Unreleased]
- [Fix hang when user input is requested](https://github.com/BetterThanTomorrow/calva/issues/377)

## [2.0.52] - 2019-10-19
- [Add info box for VIM Extension users](https://github.com/BetterThanTomorrow/calva/issues/396)
- [Fix undefined namespace when starting a shadow-cljs cljs REPL Window ](https://github.com/BetterThanTomorrow/calva/issues/115)
- [Make opening the REPL window on connect async](https://github.com/BetterThanTomorrow/calva/issues/399)
- [Fix shadow-cljs menuSelections for Custom Connect Sequences](https://github.com/BetterThanTomorrow/calva/issues/404)

## [2.0.51] - 2019-10-15
- [Toggle the "Use WSL" setting requires extension restart to effect definition provider](https://github.com/BetterThanTomorrow/calva/issues/397)
- [Go to Definition and Peek Definition not working on Windows 10 when using WSL](https://github.com/BetterThanTomorrow/calva/issues/132)
- [Highlight extension settings are uninitialized if no closure editor active on activation ](https://github.com/BetterThanTomorrow/calva/issues/401)
- [Overly aggressive paredit in REPL window](https://github.com/BetterThanTomorrow/calva/issues/255)
- [REPL window use it own set of paredit hotkeys and these are not configurable](https://github.com/BetterThanTomorrow/calva/issues/260)
- [Completion in REPL window should work like in the editor](https://github.com/BetterThanTomorrow/calva/issues/394)

## [2.0.50] - 2019-10-15
- Move user documentation from the wiki to: https://calva.readthedocs.io/

## [2.0.49] - 2019-10-11
- [Fix bugs in comment form selection](https://github.com/BetterThanTomorrow/calva/issues/374)
- [Use of undeclared var in REPL window resets the namespace](https://github.com/BetterThanTomorrow/calva/issues/257)
- [Remove warning that extensions use the `vscode-resource:` scheme directly](https://github.com/BetterThanTomorrow/calva/issues/391)

## [2.0.48] - 2019-10-11
- [Support Jack-in without file open for single-rooted workspace](https://github.com/BetterThanTomorrow/calva/issues/366)
- [Show argument list of fn](https://github.com/BetterThanTomorrow/calva/issues/238)
- [Make code more robust in case Jack-in task fails](https://github.com/BetterThanTomorrow/calva/issues/367)
- [Fix dimming out of stacked ignored forms](https://github.com/BetterThanTomorrow/calva/issues/385)
- [The extension should specify the default schemes for document selectors](https://github.com/BetterThanTomorrow/calva/issues/368)

## [2.0.46] - 2019-10-08
- [Connect warnings and errors as popups](https://github.com/BetterThanTomorrow/calva/issues/356)
- [Don't remove default indents when Calva is not the auto-formatter](https://github.com/BetterThanTomorrow/calva/pull/383)

## [2.0.44] - 2019-10-05
- [Support for custom project/workflow commands](https://github.com/BetterThanTomorrow/calva/issues/281)

## [2.0.43] - 2019-10-03
- [Insourcing @tonsky's Clojure Warrior, now named Calva Highlight](https://github.com/BetterThanTomorrow/calva/pull/362)
- [Update status bar when configuration changed](https://github.com/BetterThanTomorrow/calva/issues/358)

## [2.0.42] - 2019-09-29
- [Adding selected calva commands to the editors context menu](https://github.com/BetterThanTomorrow/calva/issues/338)
- [Fix bug with painting all existing result decoration with the same status](https://github.com/BetterThanTomorrow/calva/issues/353)
- [Fix bug with reporting errors using off-by-one line and column numbers](https://github.com/BetterThanTomorrow/calva/issues/354)

## [2.0.41] - 2019-09-28
- [Add pretty print mode](https://github.com/BetterThanTomorrow/calva/issues/327)
- [Add command for evaluating top level form as comment](https://github.com/BetterThanTomorrow/calva/issues/349)
- [Stop writing results from **Evaluate to Comment** to output pane](https://github.com/BetterThanTomorrow/calva/issues/347)

## [2.0.40] - 2019-09-25
- [Add command for connecting to a non-project REPL](https://github.com/BetterThanTomorrow/calva/issues/328)
- [Add hover to inline result display, containing the full results](https://github.com/BetterThanTomorrow/calva/pull/336)
- [Better inline evaluation error reports with file context](https://github.com/BetterThanTomorrow/calva/issues/329)
- [Enhancement REPL window handling / nREPL menu button](https://github.com/BetterThanTomorrow/calva/issues/337)
- [Print async output, and a setting for where it should go](https://github.com/BetterThanTomorrow/calva/issues/218)
- [Fix REPL window prompt does not always reflect current ns](https://github.com/BetterThanTomorrow/calva/issues/280)
- [Escape HTML in stdout and stderr in REPL window](https://github.com/BetterThanTomorrow/calva/issues/321)
- [Add content security policy to webview and remove image load error](https://github.com/BetterThanTomorrow/calva/issues/341)

## [2.0.39] - 2019-09-20
- [Revert disconnecting and jacking out on closing of REPL window](https://github.com/BetterThanTomorrow/calva/issues/326)

## [2.0.38] - 2019-09-14
- [Close java processes when closing or reloading VS Code. (Windows)](https://github.com/BetterThanTomorrow/calva/issues/305)

## [2.0.37] - 2019-09-14
- [Support connecting to Leiningen and CLI project using shadow-cljs watcher](https://github.com/BetterThanTomorrow/calva/issues/314)
- Fix [Figwheel Main deps added to non-cljs projects](https://github.com/BetterThanTomorrow/calva/issues/317)

## [2.0.36] - 2019-09-12
- Fix [REPL Window namespace being reset to user](https://github.com/BetterThanTomorrow/calva/issues/302)
- Update nrepl-version to 0.22.1

## [2.0.35] - 2019-09-10
- [Customizing the REPL connect sequence](https://github.com/BetterThanTomorrow/calva/issues/282)
- [Support for launching with user aliases/profiles](https://github.com/BetterThanTomorrow/calva/issues/288)

## [2.0.34] - 2019-09-04
- More accurate code completion lookups.
- [Keep focus in editor when evaluating to the REPL Window](https://github.com/BetterThanTomorrow/calva/issues/229).

## [2.0.33] - 2019-08-17
- Support for starting leiningen and clj projects with aliases.

## [2.0.31] - 2019-08-13
- Support Jack-in and Connect in multi-project workspaces.
- Fix bug with snippet field navigation not working.

## [2.0.30] - 2019-08-04
- nREPL status bar indicator can now be styled

## [2.0.29] - 2019-08-04
- Fix jack-in command quoting for `zsh`.

## [2.0.28] - 2019-08-01
- Jack in quoting fixes, mainly for Windows with `clojure/clj`.
- Fix formatting bug when forms not separated by whitespace.

## [2.0.25] - 2019-07-12
- Add command for running test under cursor (at point in CIDER lingo).

## [2.0.24] - 2019-07-12
- Add ParEdit `forwardUpSexp`.

## [2.0.20] - 2019-06-20
- Improve custom CLJS REPL.

## [1.3.x -> 2.0.20] - -> 06.2019
... huge gap in the Changelog. Sorry about that, but now we have decided to pick up maintaining this log again.

## [1.3.0] - 2018-04-16
- Add support for [shadow-cljs](http://shadow-cljs.org). Please contact me with any information on how this is working for you out there.

## [1.2.14] - 2018-04-06
- Change all keyboard shortcuts to use prefix `ctrl+alt+v`, due to old prefix not working on some alternate keyboard layouts. See [Issue #9](https://github.com/PEZ/clojure4vscode/issues/9).

## [1.2.12] - 2018-04-06
- Add command for re-running previously failing tests (`ctrl+alt+v ctrl+t`). 

## [1.2.10] - 2018-04-03
- Add command for toggling automatic adjustment of indentation for new lines (`ctrl+alt+v tab`)

## [1.2.8] - 2018-04-02
- Auto adjust indent more close to this Clojure Style Guide: https://github.com/bbatsov/clojure-style-guide

## [1.2.1] - 2018-03-28
- Select current (auto-detected) form

## [1.2.0] - 2018-03-28
- Terminal REPLs
  - Integrates REPL sessions from the Terminal tab and lets you do stuff like load current namespace ad evaluate code from the editor in the REPL.
- Connection and reconnection stabilization
  - Connecting the editor REPLs was a bit unstable. Now more stable (but there are still some quirks).

## [1.1.20] - 2018-03-25
- Auto detection of forms to evaluate now considers reader macro characters prepending the forms. E.g. before if you tried to evaluate say `#{:a :b :c}` with the cursor placed directly adjacent to the starting or ending curly braces only `{:a :b :c}` would be auto detected and evaluated.
- Highlighting of auto detected forms being evaluated.
- Rendering evaluation errors in the editor the same way as successful (but in red to quickly indicate that the evaluation errored).

![Evaluation demo](/assets/howto/evaluate.gif)

## [1.1.15] - 2018-03-20
- Evaluates vectors and maps with the same ”smart” selection as for lists.

## [1.1.11] - 2018-03-20
- Add inline annotations for interactive code evaluation results.

## [1.1.9] - 2018-03-18
- Add toggle for switching which repl connection is used for `cljc` files, `clj` or `cljs`.

![CLJC repl switching](/assets/howto/cljc-clj-cljs.gif)

- `clj` repl connected to all file types, meaning you can evaluate clojure code in, say, Markdown files.


## [1,1.3] - 2018-03-17
- User setting to evaluate namespace on save/open file (defaults to **on**)

## [1.1.1] - 2018-03-16
- Release of v1, based on **visual:clojure** v2.0, adding:
    - Running tests through the REPL connection, and mark them in the Problems tab
        - Run namespace tests: `ctrl+alt+v t`
        - Run all tests: `ctrl+alt+v a`
    - Evaluate code and replace it in the editor, inline: `ctrl+alt+v e`
    - Error message when evaluation fails
    - Pretty printing evaluation results: `ctrl+alt+v p`
    - Support for `cljc` files (this was supposed to be supported by the original extension, but bug)

