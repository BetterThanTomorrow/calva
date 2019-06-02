# Calva: Clojure & ClojureScript support for VS Code

![Calva logo](/assets/calva-64h.png)

Welcome to [Calva](https://marketplace.visualstudio.com/items?itemName=cospaia.clojure4vscode), an easy to use integrated REPL powered environment for productive Clojure and ClojureScript coding. It includes inline code evaluation, Paredit (and some little Parinfer), a Clojure formatter, a test runner, Clojure syntax highlighting, and more. Much of the power is provided by [The Orchard](https://github.com/clojure-emacs/orchard).

*Calva is short for Calvados, a liquid gifted to humanity from God. It is made from Cider.*

## Raison d´être

With Calva I hope to help lowering the barriers into the Clojure world. Leveraging the stregths of VS Code and nREPL together I can offer a productive environment in which to learn and to use Clojure and ClojureScript.

## How to use

There's an easy way and a hard way 😀. The easy way is to let Calva start your project for you (this is also called *Jack-in*):

1. Open a Clojure file in a Clojure project.
1. Issue the command **Start a REPL project and connect**: `ctrl+alt+c ctrl+alt+j`.
1. Answer the quick-pick prompts telling Calva about project types and what profiles to start.

When Calva has connected, it will open a REPL window giving you some getting started tips, and you can start hacking. The first thing you should always do to ”wake” Calva is to load/evaluate the current Clojure(Script) file: `ctrl+alt+c enter`.

The hard way is to start the REPL yourself, getting all the dependencies right. This is necessary for some projects. Find some more info about this on the Calva wiki.

Please also read: [Getting started](https://github.com/BetterThanTomorrow/calva/wiki/Getting-Started). 

You might want to start with evaluating some code. Calva has this notion about the ”current” form (the symbol under the cursor or the paren enclosed s-expr immediately adjacent to the cursor). Issue the **Evaluate current form (or selection)** command: `ctrl+alt+c e`. It looks something like so:

![Annotate clojure code evaluation!](assets/howto/evaluate.gif)

## Features

### At a glance
- Evaluate code inline
- Run tests
- Integrated repl windows
- Intellisense
- Go to / Peek at definition
- View docstrings on hover
- View function signatures on hover
- Supports all clojure filetypes, clj, cljc and cljs.
- Easy toggle between clj and cljs repl for cljc files
- Autoindent according to: https://github.com/bbatsov/clojure-style-guide
- Enables `clj` evaluation of clojure code in all files (e.g. Markdown, etcetera).
- Support for [Clojure tools/deps](), [Leiningen](), [shadow-cljs](http://shadow-cljs.org), [lein-figwheel](), and [Figwheel Main](). ([Boot]() to be added.)

Demo: switch between clj and cljs repl sessions for cljc files:

![CLJC repl switching](/assets/howto/cljc-clj-cljs.gif)

### More in depth (and some usage info)
- Running tests through the REPL connection, and mark them in the Problems tab
  - Run namespace tests: `ctrl+alt+c t`
  - Run all tests: `ctrl+alt+c shift+t`
  - Rerun previously failing tests: `ctrl+alt+c ctrl+t`
  - Marks test failures using the Problem tab
  - User setting for running namespace tests on save (defaults to **on**)
  - **Caveat**: Right now the tests are reported only when all are run, making it painful to run all tests in larger projects. I'll fix it. Promise!
- Code evaluation
  - Evaluate code at cursor and show the results as annotation in the editor: `ctrl+alt+c e`
    - Dismiss the display of results by pressing `escape` (there is info on the wiki for **vim** extension users).
  - Evaluate code and replace it in the editor, inline: `ctrl+alt+c r`
  - Pretty printing evaluation resuls: `ctrl+alt+c p` (Currently broken, see issues on Github).
  - Evaluate current top level form (based on where the cursor is) and show results inline: `ctrl+alt+c space`
    - Send the current top level form to the REPL terminal: `ctrl+alt+c alt+space`
  - Error information when evaluation fails (at least a hint)
  - Support for `cljc` files and you can choose if they should be evaluated by the `clj` or the `cljc` repl session.
  - Enables `clj` repl for all files/editors. You now can evaluate those clojure code snippets in Markdown files.
  - The evaluation commands will auto-”detect” vectors and maps as well as list.
  - User setting to evaluate namespace on save/open file (defaults to **on**)
- Integrated REPLs
  - Switch to current namespace in the REPL window: `ctrl+alt+c n`
  - Load current namespace in the REPL window: `ctrl+alt+c alt+n`
  - Evaluate code from the editor to the REPL window: `ctrl+alt+c alt+e`
- When editing `cljc` files, easily choose if repl commands should go to the `clj` or `cljs` repl by clicking the `cljc/clj[s]` indicator in the status bar.
- Selection of current form: `ctrl+alt+c s`. Auto-detected the same way as for evaluation. Will select the form preceding or following the cursor first, otherwise the form the cursor is inside. (Only when the cursor is directly adjacent to any bracket so far.)

Demo: Peek at defintions, etcetera:

![Features](/assets/howto/features.gif)

## Calva Paredit and Calva Formatter included

With Calva you also get structural editing using [Paredit](/calva/calva-fmt/README.md) and [formatting](/calva/paredit/README.md).

You really should have a look at the READMEs for those as well. One thing to note about it is that Calva Formatter sets the default keybinding of the **Format current form** command to `tab`. Good to know, right?

## Clojure Warrior included

This extension bundles @tonsky's Clojure Warrior. Bringing you, amongst other things, raindbow parens and sane bracket matching. This allows Calva to diable VS Code's built in (not so sane) bracket matching.

## Future Stuff

There are lots of stuff that needs attention and lots of possible features to add. The following is **not** a comprehensive list:

* Test reporting while tests are being run.
* Open as many REPLs as you like.
* Custom user commands to execute over the REPL connection.
* List symbols in the current file.
* Let me know what you want. See below for ways to reach me about Calva.

## How to contribute

Calva is built using a combination of TypeScript and ClojureScript. The ClojureScript part uses the [shadow-cljs](http://shadow-cljs.org) toolchain. See the [How to Contribute](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute) page on the wiki for instructions on how to hack on Calva.

## Other

### Started from Visual Clojure

Calva once started off as a clone of the promising (but abandoned) **visual:clojure** extension.

## Happy coding ❤️

I hope you will find good use for this extension. Please let me know what you think or want! PRs welcome, file an issue or chat me up in the [`#calva-dev`](https://clojurians.slack.com/messages/calva-dev/) channel in the Clojurians Slack too, (I'm @pez there). Tweeting [@pappapez](https://twitter.com/pappapez) works is appreciated too.
