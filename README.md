# Calva: Clojure & ClojureScript support for VS Code

![Calva logo](https://raw.githubusercontent.com/BetterThanTomorrow/calva/dev/assets/calva-64h.png)

Welcome to [Calva](https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.calva), an integrated REPL powered environment for enjoyable and productive [Clojure](https://clojure.org) and [ClojureScript](https://clojurescript.org) in Visual Studio Code. It includes inline code evaluation, Paredit (and some little Parinfer), a Clojure formatter, a test runner, Clojure syntax highlighting, and more. Much of the power is provided by [The Orchard](https://github.com/clojure-emacs/orchard).

*Calva is short for Calvados, a liquid gifted to humanity from God. It is distilled from [Cider](https://cider.mx/).*

## Raison d´être

Calva's main reason for existance is to _provide Visual Studio Code users with an easy to use and productive environment for Clojure and ClojureScript development_. We also hope that Calva will contribute to making it easier to pick up Clojure as a new language.

## Getting Started with Calva

Go to the [documentation](https://calva.readthedocs.io/) to find info on how to connect Calva to your project and start evaluating code and such. The documentation is built from the same repository as Calva. So if you know about workarounds or gotchas or anything that is good to know about when using Calva, please edit the appropriate page (or create a new page) by PR.

## Features
- Syntax highlighting, plus:
  - Rainbow parens
  - Highlights misplaced brackets
  - LISP friendly bracket matching
  - Ignore form (`#_`) dimming and `(comment)` form highlighting
- Code formatting and autoindent according to https://github.com/bbatsov/clojure-style-guide
- Structural Editing (via [Paredit](https://calva.readthedocs.io/en/latest/paredit.html))
- Intellisense
- Go to / Peek at definition
- View docstrings on hover
- View function signatures on hover
- Support for [Clojure tools/deps](https://clojure.org/guides/deps_and_cli), [Leiningen](https://leiningen.org), [shadow-cljs](http://shadow-cljs.org), [lein-figwheel](https://github.com/bhauman/lein-figwheel), and [Figwheel Main](https://figwheel.org), and Nashorn repls. (For [Boot](https://boot-clj.com), only Connect scenarios work, there is no Jack-in yet.)
- Your [Custom Connect Sequences](https://calva.readthedocs.io/en/latest/connect-sequences.html), including fully customized CLJS REPLs.
- Switch the CLJS REPL connection between your different CLJS builds at will.
- When editing `cljc` files, easily choose if REPL commands should go to the `clj` or `cljs` REPL by clicking the `cljc/clj[s]` indicator in the status bar.
- And more


Demo: Peek at definitions, etcetera:

![Features](/assets/howto/features.gif)

Demo: switch between `clj` and `cljs` repl sessions for `cljc` files:

![CLJC repl switching](/assets/howto/cljc-clj-cljs.gif)

## How to contribute

I'm glad you are reading this section!

Calva is built using a combination of TypeScript and ClojureScript. The ClojureScript part uses the [shadow-cljs](http://shadow-cljs.org) toolchain. See the [How to Contribute](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute) page on the wiki for instructions on how to hack on Calva.

## The Calva Team

Many people have contributed to Calva. Here are the ones who have engaged in the project as such.

### Current Maintainers:

* [Peter Strömberg](https://github.com/PEZ)
* [Kevin Stehn](https://github.com/kstehn)
* [Christian Fehse](https://github.com/cfehse)

### Alumni
* [Matt Seddon](https://github.com/mseddon)
* [Pedro Girardi](https://github.com/pedrorgirardi)
* [Stian Sivertsen](https://github.com/sivertsenstian) (Creator of Visual:Clojure)

## Happy coding ❤️

We hope you will find good use for Calva. Please let us know what you think. PRs welcome, file an issue or chat us up in the [`#calva-dev`](https://clojurians.slack.com/messages/calva-dev/) channel in the Clojurians Slack.
