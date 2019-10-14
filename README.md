# Calva: Clojure & ClojureScript support for VS Code

![Calva logo](https://raw.githubusercontent.com/BetterThanTomorrow/calva/dev/assets/calva-64h.png)

Welcome to [Calva](https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.calva), an integrated REPL powered environment for enjoyable and productive [Clojure](https://clojure.org) and [ClojureScript](https://clojurescript.org) in Visual Studio Code. It includes inline code evaluation, Paredit (and some little Parinfer), a Clojure formatter, a test runner, Clojure syntax highlighting, and more. Much of the power is provided by [The Orchard](https://github.com/clojure-emacs/orchard).

*Calva is short for Calvados, a liquid gifted to humanity from God. It is distilled from [Cider](https://cider.mx/).*

## Raison d´être

Calva's main reason for existance is to _provide Visual Studio Code users with an easy to use and productive environment for Clojure and ClojureScript development_. We also hope that Calva will contribute to making it easier to pick up Clojure as a new language.

## How to Connect Calva to your project

Let Calva start your project _a.k.a. **Jack-in**_. (Assuming you have a single project workspace. See [Workspace Layout](https://calva.readthedocs.io/en/stable/workspace-layouts.html) for other setups)

1. Open your project folder in VS Code.
1. Issue the command **Start a Project REPL and Connect (aka Jack-In)**: `ctrl+alt+c ctrl+alt+j`.
1. Answer the prompts where Calva asks you a few things about your project.

When Calva has connected, it will open a REPL window giving you some getting started tips, and you can start hacking.

Troubles connecting? See [Connect Calva to Your Project](https://calva.readthedocs.io/en/stable/connect.html). (Please help keep that page updated.)

## Something to try first

You might want to start with evaluating some code. Calva has this notion about the ”current” form. Issue the **Evaluate Current Form Inline** command, `ctrl+alt+c e` with the cursor placed in different locations to get a feeling for how the current form is determined.

There is also a command for evaluating the current top level form. Good for evaluating  various `def`s `defn`, `defthis`, `defthat`. With your cursor placed anywhere inside such a form, issue the **Evaluate Current Top Level Form (defun)** command (`ctrl+alt+c space`).

The Top Level command also works inside `(comment ...)` forms, treating the `comment` as creating a new top level context. It is good for in-file code experimentation.  To use it place the cursor inside a form contained inside a `(comment...)` and issue the command from there. It looks something like so:

![Annotate clojure code evaluation!](assets/howto/evaluate.gif)

See also [Calva Top 10 Commands](https://calva.readthedocs.io/en/stable/commands-top10.html).

## There is More Documentation

When something doesn't work and you think there might be a workaround for it, please see the [documentation site](https://calva.readthedocs.io/). It is built from the same repository as Calva. So if you know about workarounds or gotchas or anything that is good to know about when using Calva, please edit the appropriate page (or create a new page) by PR.

## Features
- Syntax highlighting, plus:
  - Rainbow parens
  - Highlights misplaced brackets
  - LISP friendly bracket matching
  - Ignore form (`#_`) dimming and `(comment)` form highlighting
- Code formatting and autoindent according to https://github.com/bbatsov/clojure-style-guide
- Support for [Clojure tools/deps](https://clojure.org/guides/deps_and_cli), [Leiningen](https://leiningen.org), [shadow-cljs](http://shadow-cljs.org), [lein-figwheel](https://github.com/bhauman/lein-figwheel), and [Figwheel Main](https://figwheel.org), and Nashorn repls. (For [Boot](https://boot-clj.com), only Connect scenarios work, there is no Jack-in yet.)
- Your [Custom Connect Sequences](https://calva.readthedocs.io/en/stable/connect-sequences.html), including fully customized CLJS REPLs.
- Switch the CLJS REPL connection between your different CLJS builds at will.
- Intellisense
- Go to / Peek at definition
- View docstrings on hover
- View function signatures on hover

### More features (and some usage info)
- Running tests through the REPL connection, and mark them in the Problems tab
  - Run namespace tests: `ctrl+alt+c t`
  - Run all tests: `ctrl+alt+c shift+t`
  - Run current test: `ctrl+alt+c ctrl+alt+t`
  - Rerun previously failing tests: `ctrl+alt+c ctrl+t`
  - Marks test failures using the Problem tab
  - User setting for running namespace tests on save (defaults to **on**)
  - **Caveat**: Right now the tests are reported only when all are run, making it painful to run all tests in larger projects. I'll fix it. Promise!
- Code evaluation
  - Evaluate code at cursor and show the results as annotation in the editor: `ctrl+alt+c e` (`ctrl+alt+c v` on Windows)
    - Dismiss the display of results by pressing `escape` (VIM Extension users should read [Using Calva with the VIM Extension](https://calva.readthedocs.io/en/stable/vim.html)).
  - Evaluate code and replace it in the editor, inline: `ctrl+alt+c r`
  - Evaluate code and add as comment: `ctrl+alt+c c` (current form), `ctrl+alt+c ctrl space` (current _top level_ form)
  - Evaluate current top level form (based on where the cursor is) and show results inline: `ctrl+alt+c space`
    - Send the current top level form to the REPL terminal: `ctrl+alt+c ctrl+alt+space`
  - Toggle pretty printing of results on and off: `ctrl+alt+c p`. It's on by default. There is a status bar button showing the status and that also can be used to toggle the setting.
  - Error information when evaluation fails (at least a hint)
  - Support for `cljc` files and you can choose if they should be evaluated by the `clj` or the `cljc` repl session.
  - Enables `clj` REPL for all files/editors. You now can evaluate those Clojure code snippets in Markdown files.
  - The evaluation commands will auto-”detect” vectors and maps as well as list.
  - User setting to evaluate namespace on save/open file (defaults to **on**)
- Integrated REPLs
  - Load current namespace in the REPL window: `ctrl+alt+c ctrl+alt+n`
  - Evaluate code from the editor to the REPL window: `ctrl+alt+c ctrl+alt+e` (`ctrl+alt+c ctrl+alt+v` on Windows)
- When editing `cljc` files, easily choose if REPL commands should go to the `clj` or `cljs` REPL by clicking the `cljc/clj[s]` indicator in the status bar.
- Selection of current form: `ctrl+alt+c s`. Auto-detected the same way as for evaluation. Will select the form preceding or following the cursor first, otherwise the form the cursor is inside. (Only when the cursor is directly adjacent to any bracket so far.)
- Configure and run custom commands, i.e. code snippets, at will: `ctrl+alt+c .`

Demo: Peek at definitions, etcetera:

![Features](/assets/howto/features.gif)

Demo: switch between `clj` and `cljs` repl sessions for `cljc` files:

![CLJC repl switching](/assets/howto/cljc-clj-cljs.gif)

### Test features not available with ClojureScript

Currently [`cider-nrepl` does not provide its test functionality for ClojureScript](https://github.com/clojure-emacs/cider-nrepl/issues/555) code. Please consider contributing to fixing that.

## Calva Paredit and Calva Formatter included

With Calva you also get structural editing using [Paredit](/src/paredit/README.md) and [formatting](/src/calva-fmt/README.md).

You really should have a look at the READMEs for those as well. One thing to note about it is that Calva Formatter sets the default keybinding of the **Format Current Form** command to `tab`. Good to know, right?

### Using with Parinfer

Calva defaults to formatting as you type. If you use Parinfer this creates a conflict, since it auto-indents your code. If you want to use Parinfer you'll have to tell Calva not to do auto-formatting by disabling `calva.fmt.formatAsYouType`.

### Slurp and Barf keyboard shortcuts

To make slurping and barfing forward really easy to perform they are bound to `ctrl+right` and `ctrl+left`, respectively. However on MacOS those shortcuts are sometimes bound by Mission Control, causing the Calva shortcuts to not work. One way to solve it is to disable the shortcuts in *System Preferences -> Keyboard -> Shortcuts*:

![Disable Mission Control Shortcuts](/assets/mission-control-shortcuts.gif)

## Calva Highlight

Calva takes care of syntax highlighting, and also provides some features not available through VS Code's highlighting mechanism. These extras inclode rainbow parens, sane bracket matching, and comment form dimming/highlighting.

You are in charge of how brackets and comments are highlighted:

| Setting | Meaning | Example |
| --- | ------- | ------- |
| `"calva.highlight.enableBracketColors"` | Enable rainbow colors |  `true` |
| `"calva.highlight.bracketColors"` | Which colors to use |  `["#000", "#999"]` |
| `"calva.highlight.cycleBracketColors"` | Whether same colors should be reused for deeply nested brackets | `true` |
| `"calva.highlight.misplacedBracketStyle"` | Style of misplaced bracket | `{ "border": "2px solid #c33" }` |
| `"calva.highlight.matchedBracketStyle"` | Style of bracket pair highlight | `{"backgroundColor": "#E0E0E0"}` |
| `"calva.highlight.ignoredFormStyle"` | Style of `#_...` form | `{"textDecoration": "none; opacity: 0.5"}` |
| `"calva.highlight.commentFormStyle"` | Style of `(comment ...)` form | `{"fontStyle": "italic"}` |

The extras are built from **Clojure Warrior**, created by [Nikita Prokopov, a.k.a. @tonsky](https://tonsky.me)'s. Please note that the default styling for `(comment ...)` forms now is to italicize them (instead of dimming). This is to promote using `comment` forms to work with the REPL. See **Something to try first**, above for more on evaluating code in `comment` forms.

## Conflicting with Parinfer extension

There have been reports of the Parinfer extension and Calva not working too well together. You might to some extent get away with switching off Calva's formatting as-you-type, but also you might not. With Calva it is probably better to learn to use Paredit **slurp** and **barf** and generally rely on Calva's automatic formatting.

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
