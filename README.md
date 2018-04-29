# Calva: Clojure & Clojurescript support for VS Code

[Integrated REPL, linting, inline eval, test runner, and more](https://marketplace.visualstudio.com/items?itemName=cospaia.clojure4vscode). Powered by Cider & nRepl.


## Raison d´être

Try to bring some of the Emacs CIDER experience to VS Code. Supporting both Clojure and ClojureScript. Hopefully lowering the barriers to the Clojarian world. If we can bring some productive concepts from other Clojure dev environments, like Cursive, to VSCode as well, we will.

Demo: evaluate files

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
  - Evaluate code and show the results as annotation in the editor: `ctrl+alt+v e`
  - Evaluate code and replace it in the editor, inline: `ctrl+alt+v r`
  - Pretty printing evaluation resuls: `ctrl+alt+v p`
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


## Future Stuff

* Test reporting while tests are being run. HIGH PRIORITY.
* Open as many REPLs as you like.
* Custom user commands to execute over the REPL connection.
* Commands to start the REPLs from VS Code, injecting dependencies automatically.
* Let me know what you want. PRs welcome, file an issue or tweet me: [@pappapez](https://twitter.com/pappapez)

## Team

Haha, but actually we are now two, so that's a team. Neither of us actually have a lot of spare time, but Calva is a dear project so we try.

* [Peter Strömberg](https://github.com/PEZ)
* [Pedro Girardi](https://github.com/pedrorgirardi)
* Your name here

## Usage notes

Mostly Calva just works, but there are still some things to know beforehand. One good thing to know is that all commands and settings are of the category `Calva`, so bringing up the VSCode's list of commands or settings and searching for ”Calva” will take you a long way.

It is also necessary to know that Calva does not start the Clojure/Clojurescript repls for you. You will need to start them some other way (usually in a terminal), then connect.

### Autolinting

The extension comes with autolinting disabled. This is because you will need to have [Joker](https://github.com/candid82/joker) installed in order for it to work. You will probably want to have Joker installed regardless so, just do it and then enable autolinting by setting:
```
"calva.lintOnSave": true
```

#### Unrecognized macros
One thing to note with this linter is that it doesn't do a full scan of all files and does not recognize macros it doesn't know about. Leading to false complains about `Unable to resolve symbol x`. You might now and then tell it about macros you use. Create a `.joker` file somewhere in the path from the root of your project to where you are using the macro (the project root might be the best choice), and add:
```
{:known-macros [some-ns/some-macro some-other-ns/some-other-macro]}
```
Read more about Joker's linter mode here: https://github.com/candid82/joker#linter-mode

### Dependencies

(See also about Autolinting above.)

Calva uses nrepl for evaluation / communication, and cider-nrepl for added nrepl functionality

Best place, imho, to configure them is in the `~/.lein/profiles.clj` like so:

```
{:repl {:plugins [[cider/cider-nrepl "0.16.0"]]
        :dependencies [[org.clojure/tools.nrepl "0.2.12"]]}
```

If you are only using Clojure then you are all set.

#### For Clojurescript

This depends some on wether the project is powered by **Figwheel** or **shadow-cljs** or something else.

##### Figwheel
Most ClojureScript projects has this setup in the project configuration file. But you can have it configured in your profiles.clj as well. A complete repl profile (from Calva's point of view, will look like so:

```clojure
{:repl {:plugins [[cider/cider-nrepl "0.16.0"]]
        :dependencies [[org.clojure/tools.nrepl "0.2.12"]
                       [com.cemerick/piggieback "0.2.2"]
                       [figwheel-sidecar "0.5.14"]]
        :repl-options {:nrepl-middleware [cemerick.piggieback/wrap-cljs-repl]}}}
```

##### shadow-cljs

See the [Calva section](https://shadow-cljs.github.io/docs/UsersGuide.html#_calva_vs_code) in the shadow-cljs User Guide.

TL;DR; You need `cider-nrepl` in your classpath. Add `[cider/cider-nrepl "0.16.0"]` to the `:dependencies` map in the`shadow-cljs.edn` project config. Shadow-cljs will autoinject the other requirements when it encounters cider-nrepl.

### Connecting to the REPL

Calva defaults to automatically connecting to a running nrepl session, it does not start the repl for you. Start it from the terminal/command prompt if it is not running. Leiningen users do it like so:

```
$ lein repl
```

Shadow-cljs folks do not need to start an interactive repl. It's enough to start the app like so:

```
$ shadow-cljs watch <build>
```

When the app is running, start VS Code and open the project root directory. The extension will then connect, and you are ready to bend the laws of nature using Clojure.

Yay! 🍾 🎆 ✨

**Note** If your workspace root is not the same as the project root of your Clojure project you must tell Calva which sub directory is the project root. Search for `calva.projectRootDirectory` in settings and modify the workspace settings. This path should be relative to the workspace root (which is why it defaults to `.`).

#### ClojureScript REPL

For Calva to be able to connect the Clojurescript repl, your ClojureScript app needs to be running and connected to the repl session. (Calva is at the moment only tested with browser apps, but might work with other project types as well anyway.)

##### shadow-cljs projects

When Calva detects a shadow-cljs project it will read the `shadow-cljs.edn` configuration file and give you a list of build ids to pick from. Pick the build you started the app from and ClojureScript power should get injected into your favorite editor.

##### Figwheel projects
If you want to use ClojureScript, you start its repl off of the repl you have just started, i.e. **not** using `lein figwheel` because then the extension will not know how to connect. Open the project in VS Code and the extension will connect to the ClojureScript repl for `cljs` files and to the Clojure repl for `clj` and `cljc` files.

Yay! 🥂 🤘 🍻

Read on for some pointers on this if you are not familiar.

**To initiate a figwheel-repl you need the figwheel-sidecar dependency -> [figwheel-sidecar "0.5.8"] as well correct cljs classpaths**
read more about this [here](https://github.com/bhauman/lein-figwheel/wiki/Using-the-Figwheel-REPL-within-NRepl)

If you have created a figwheel-project from a template (using e.g. lein new), you should be good to go as long as you start the repl in the projects folder.

Having started the initial repl like above with ```lein repl```, initiate figwheel from there (beacuse reasons stated above). Then:

```
 (use 'figwheel-sidecar.repl-api)
 (start-figwheel!)
 (cljs-repl)
```

Consider adding a `(start)` function in your projects `dev` namespace to pack these calls together.


## Other stuff

### Paredit & Parinfer
Calva works nicely together with [Paredit](https://marketplace.visualstudio.com/items?itemName=cospaia.paredit-revived). Make sure you use the maintained version. We call it **Paredit Revived**.

However [Parinfer](https://marketplace.visualstudio.com/items?itemName=shaunlebron.vscode-parinfer) clashes with the auto adjustment of indents feature. Therefore Calva provides a command for toggling the auto adjustment off and on (`ctrl+alt+v tab`), just like Parinfer has commands for enabling and disabling its assistance.

Consider these settings for keeping auto adjust of indents on:
```json
    "parinfer.defaultMode": "disabled",
    "calva.autoAdjustIndent": true,
```

Switch them around if you prefer to default to Parinfer on. We'll be looking for a solution to this problem.

### Built on Visual Clojure

Calva started off as a clone of the promising (but abandoned) **visual:clojure** extension.

## Happy coding

We hope you will find tons of use for this extension! Please let us know what you think or want. PRs welcome, file an issue or chat us (@pez, @pedrorgirardi) up in the [`#editors` channel](https://clojurians.slack.com/messages/editors/) of the Clojurians Slack. Tweeting [@pappapez](https://twitter.com/pappapez) works too.

❤️