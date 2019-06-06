# Calva: Clojure & ClojureScript support for VS Code

![Calva logo](https://raw.githubusercontent.com/BetterThanTomorrow/calva/dev/assets/calva-64h.png)

Welcome to [Calva](https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.calva), an easy to use, integrated REPL powered environment for enjoyable and productive [Clojure](https://clojure.org) and [ClojureScript](https://clojurescript.org) coding. It includes inline code evaluation, Paredit (and some little Parinfer), a Clojure formatter, a test runner, Clojure syntax highlighting, and more. Much of the power is provided by [The Orchard](https://github.com/clojure-emacs/orchard).

*Calva is short for Calvados, a liquid gifted to humanity from God. It is distilled from [Cider](https://cider.mx/).*

## Raison d´être

With Calva I hope to help lowering the barriers into the Clojure world. The idea is that by leveraging the strengths of VS Code and nREPL, I can offer a turn-key, productive, environment in which to learn and to use Clojure and ClojureScript.

## How to Connect Calva to your project

_Note: On windows, change the default shell from **Powershell** to **Cmd**  before trying the below. To do it, press ctrl+shift+P and type 'Terminal' and choose "Select default shell" from search drop down_.

Connect by letting Calva start your project (_a.k.a. **Jack-in**_).

1. Open your project in VS Code.
1. Issue the command **Start a REPL project and connect**: `ctrl+alt+c ctrl+alt+j`.
1. Answer the quick-pick prompts telling Calva about project types and what profiles to start.

When Calva has connected, it will open a REPL window giving you some getting started tips, and you can start hacking. The first thing you should always do to ”wake” Calva is to load/evaluate the current Clojure(Script) file: `ctrl+alt+c enter`.

_NB: Some project setups do not lend themselves to Jack-in, but Calva might still be able to connect. See [Connecting to a running REPL server](https://github.com/BetterThanTomorrow/calva/wiki/Connecting-To-a-Running-REPL-Server)_. 

## Something to try first

You might want to start with evaluating some code. Calva has this notion about the ”current” form (the symbol under the cursor or the paren enclosed s-expr immediately adjacent to the cursor). Issue the **Evaluate current form (or selection)** command: `ctrl+alt+c e`.

There are also a command for evaluating the current top level form. Which I use even more often, especially since it works inside `(commment)` forms and supports my way of experimenting with my code.  It looks something like so:

![Annotate clojure code evaluation!](assets/howto/evaluate.gif)

See [Calva Top 10 Commands](/etc/calva-top-10-commands.md) for some more things to try.

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
- Support for [Clojure tools/deps](https://clojure.org/guides/deps_and_cli), [Leiningen](https://leiningen.org), [shadow-cljs](http://shadow-cljs.org), [lein-figwheel](https://github.com/bhauman/lein-figwheel), and [Figwheel Main](https://figwheel.org). ([Boot](https://boot-clj.com) to be added.)

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

With Calva you also get structural editing using [Paredit](/calva/paredit/README.md) and [formatting](/calva/calva-fmt/README.md).

You really should have a look at the READMEs for those as well. One thing to note about it is that Calva Formatter sets the default keybinding of the **Format current form** command to `tab`. Good to know, right?

## Clojure Warrior included

This extension bundles [@tonsky](https://tonsky.me)'s [Clojure Warrior](https://marketplace.visualstudio.com/items?itemName=tonsky.clojure-warrior). Bringing you, amongst other things, rainbow parens and sane bracket matching. This allows Calva to disable VS Code's built in (not so sane) bracket matching.

## Where is Calva heading?

There are lots of stuff that needs attention and lots of possible features to add. Please see [the Github issue tracker](https://github.com/BetterThanTomorrow/calva/issues) for those things. And please regard it as a way to inform me about what is most important. (There are other ways for that as well, see below.)

Right now I am happy to have released [a major upgrade to Calva](https://clojureverse.org/t/the-calva-journey-continues-please-jack-in/4335) (”Calva dos” as they say in Spanish), but I am not satisfied. I want to make Calva an even better choice for people starting with Clojure and ClojureScript, so that is where my focus will be. Please consider helping me!

## How to contribute

I'm glad you are reading this section!

Calva is built using a combination of TypeScript and ClojureScript. The ClojureScript part uses the [shadow-cljs](http://shadow-cljs.org) toolchain. See the [How to Contribute](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute) page on the wiki for instructions on how to hack on Calva.

## Other

### Started from Visual Clojure

Calva once started off as a clone of the promising (but abandoned) **visual:clojure** extension.

## Happy coding ❤️

I hope you will find good use for Calva. Please let me know what you think. PRs welcome, file an issue or chat me up in the [`#calva-dev`](https://clojurians.slack.com/messages/calva-dev/) channel in the Clojurians Slack, (I'm @pez there). I would appreciate tweets about Calva too, and extra points for mentioning [@pappapez](https://twitter.com/pappapez).
