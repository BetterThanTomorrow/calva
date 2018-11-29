# Calva: Clojure & ClojureScript support for VS Code

[Integrated REPL, linting, inline eval, test runner, and more](https://marketplace.visualstudio.com/items?itemName=cospaia.clojure4vscode). Powered by Cider & nRepl.

About the name: *Calva is short for Calvados, a liquid gifted to humanity from God. It is made from Cider.*

## Raison d´être

Try to bring some of the Emacs CIDER experience to VS Code. Supporting both Clojure and ClojureScript. Hopefully lowering the barriers into the Clojarian world. If I can bring some productive concepts from other Clojure dev environments, like Cursive, to VSCode as well, I will.

## How to use

Calva connects to a running `nrepl` session, so you need to:
1. Start the REPL (a VS Code terminal works fine for this)
1. Open a clojure file. (This activates the Calva extension)
2. Tell Calva to connect: `ctrl+alt+v c` (default key binding).

Calva has dependencies on `tools/nrepl` and `cider/nrepl`. You need to use pretty recent versions of these. Please make sure to read the [Getting started](https://github.com/BetterThanTomorrow/calva/wiki/Getting-Started) page on the wiki to get instructions and information on how to unlock the power of the REPL inside your editor.

Demo: evaluate inline

![Annotate clojure code evaluation!](assets/howto/evaluate.gif)

## Features

### At a glance
- Evaluate code inline
- Run tests
- Integrated repls (using the VS Code Terminal)
- Intellisense
- Underlining compile-time errors
- Go to / Peek at definition
- View docstrings on hover
- View function signatures on hover
- Supports all clojure filetypes, clj, cljc and cljs.
- Easy toggle between clj and cljs repl for cljc files
- Autoindent according to: https://github.com/bbatsov/clojure-style-guide
- Enables `clj` evaluation of clojure code in all files (e.g. Markdown, etcetera).
- Support for [shadow-cljs](http://shadow-cljs.org).

Demo: switch between clj and cljs repl sessions for cljc files:

![CLJC repl switching](/assets/howto/cljc-clj-cljs.gif)

### More in depth (and some usage info)
- Running tests through the REPL connection, and mark them in the Problems tab
  - Run namespace tests: `ctrl+alt+v t`
  - Run all tests: `ctrl+alt+v shift+t`
  - Rerun previously failing tests: `ctrl+alt+v ctrl+t`
  - Marks test failures using the Problem tab
  - User setting for running namespace tests on save (defaults to **on**)
  - **Caveat**: Right now the tests are reported only when all are run, making it painful to run all tests in larger projects. I'll fix it. Promise!
- Code evaluation
  - Evaluate code at cursor and show the results as annotation in the editor: `ctrl+alt+v e`
    - Dismiss the display of results by pressing `ctrl+escape`.
  - Evaluate code and replace it in the editor, inline: `ctrl+alt+v r`
  - Pretty printing evaluation resuls: `ctrl+alt+v p`
  - Evaluate current top level form (based on where the cursor is) and show results inline: `ctrl+alt+v space`
    - Send the current top level form to the REPL terminal: `ctrl+alt+v alt+space`
  - Error information when evaluation fails (at least a hint)
  - Support for `cljc` files and you can choose if they should be evaluated by the `clj` or the `cljc` repl session.
  - Enables `clj` repl for all files/editors. You now can evaluate those clojure code snippets in Markdown files.
  - The evaluation commands will auto-”detect” vectors and maps as well as list.
  - User setting to evaluate namespace on save/open file (defaults to **on**)
- Integrated REPLs using the Terminal tab
  - Switch to current namespace in the terminal REPL: `ctrl+alt+v n`
  - Load current namespace in the terminal REPL: `ctrl+alt+v alt+n`
  - Evaluate code from the editor to the terminal REPL: `ctrl+alt+v alt+e`
- When editing `cljc` files, easily choose if repl commands should go to the `clj` or `cljs` repl by clicking the `cljc/clj[s]` indicator in the status bar.
- Selection of current form: `ctrl+alt+v s`. Auto-detected the same way as for evaluation. Will select the form preceding or following the cursor first, otherwise the form the cursor is inside. (Only when the cursor is directly adjacent to any bracket so far.)

Demo: Peek at defintions, etcetera:

![Features](/assets/howto/features.gif)

Demo: lint errors are marked in the editor. (As are unit test failures)

![underline error](/assets/howto/error.png)

## Calva Paredit and Calva Formatter included

With Calva you also get structural editing, from [Calva Paredit](https://marketplace.visualstudio.com/items?itemName=cospaia.paredit-revived) and formatting, through [Calva Formatter](https://github.com/BetterThanTomorrow/calva-fmt).

You really should have a look at the READMEs for those as well. One thing to note about it is that Calva Formatter sets the default keybinding of the **Format current form** command to `tab`. Good to know, right? Please check that README before you change the keybinding.

## Future Stuff

There are lots of stuff that needs attention and lots of possible features to add. The following is **not** a comprehensive list:

* Test reporting while tests are being run.
* Open as many REPLs as you like.
* Custom user commands to execute over the REPL connection.
* Commands to start the REPLs from VS Code, injecting dependencies automatically.
* List symbols in the current file.
* Let me know what you want. See below for ways to reach me about Calva.

## Other

### Built on Visual Clojure

Calva started off as a clone of the promising (but abandoned) **visual:clojure** extension.

### How to contribute

Calva is being ported to a combination of TypeScript and ClojureScript. The ClojureScript part uses the [shadow-cljs](http://shadow-cljs.org) toolchain. See the [How to Contribute](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute) page on the wiki for instructions on how to hack on Calva.

## Happy coding ❤️

I hope you will find good use for this extension. Please let us know what you think or want! PRs welcome, file an issue or chat me up on Zulip:

[![project chat](https://img.shields.io/badge/clojurians--zulip-calva-brightgreen.svg?logo=zulip)](https://clojurians.zulipchat.com/#narrow/stream/calva).

Other ways to reach me about Calva:
* There's a [`#calva-dev` channel](https://clojurians.slack.com/messages/calva-dev/) channel in the Clojurians Slack too, (I'm @pez there).
* Tweeting [@pappapez](https://twitter.com/pappapez) works too.
