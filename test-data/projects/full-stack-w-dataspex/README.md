# A Mini shadow-cljs Fullstack App

The very tiny [shadow-cljs](https://github.com/thheller/shadow-cljs) fullstack starter project as described in [Fullstack Workflow with shadow-cljs
](https://code.thheller.com/blog/shadow-cljs/2024/10/18/fullstack-cljs-workflow-with-shadow-cljs.html) by [Thomas Heller](https://github.com/thheller). You should probably read that article!

 (There are some some small adaptations to the original workflow project, to take advantage of Calva.)

## Usage

To get going, create and start the project using [Calva](https://calva.io) with the command:
* **Calva: Open the REPL Menu (Start/Connect a REPL, etc.)**.
* Then select **Create a mini shadow.cljs Fullstack project**.

The project will be created, opened, and started. Give it some little time and you should then be able to open the app which will be served on [localhost:3000](http://localhost:3000).

Once you've created the project, play around with it, and make it your own.

### Conveniences

* The project will automatically start the REPL, the server, and the shadow-cljs watcher, whenever you open the project folder in VS Code. You can adjust this behaviour from [the workspace settings file](.vscode/settings.json)
  * If you would like the browser to open automatically, you can update the `afterCLJReplJackInCode` in the settings to end with:
    ```clojure
    (clojure.java.browse/browse-url "http://localhost:3000")
    ```
* We use [clj-reload](https://github.com/tonsky/clj-reload) to reload updated Clojure (shadow-cljs reloads the ClojureScript code).
* There is a custom Calva REPL command added that will reload updated Clojure code and restart the server. Bring up the custom commands menu with `ctrl+alt+space space`. But you can also define a regular keybinding for this, like so:
  ```json
  {
    "key": "ctrl+alt+r r",
    "when": "calva:connected",
    "command": "calva.runCustomREPLCommand",
    "args": {
      "snippet": "(require 'repl) (repl/restart!)",
      "repl": "clj"
    }
  },
  ```

## Requirements

Java. In fact **Java is the _only_ requirement**, if you are using Calva.

For minimal requirements this project does not use NPM, and instead relies on [deps.edn/tools.deps](https://clojure.org/guides/deps_and_cli) (the `clojure` CLI tool). Since Calva has the deps.edn tool built in, you don't need to install it separately to use this project. (But you are highly recommended to install it anyway, eventually you are going to need it.)

## See also

* [Shadow CLJS User’s Guide](https://shadow-cljs.github.io/docs/UsersGuide.html)
* [clojurescript.org](https://clojurescript.org/)
* [Replicant](https://github.com/cjohansen/replicant) - Pure ClojureScript VDOM rendering. You don't need NPM (nor React) to render Hiccup.
  * Here's a mini Replicant app template: [replicant-mini-app](https://github.com/anteoas/replicant-mini-app) that you can copy, piece by piece, into this project.

## Differences from Thomas Heller's setup

The project differes only slightly from what is described in [Fullstack Workflow with shadow-cljs](https://code.thheller.com/blog/shadow-cljs/2024/10/18/fullstack-cljs-workflow-with-shadow-cljs.html):

* In the original the project REPL is started with `clj -M -m shadow.cljs.devtools.cli clj-repl`, but that doesn't start nrepl with the middleware that Calva wants. Because of this, this project relies on Calva's shadow-cljs REPL start facilities instead.
  * And thus, in [repl/start!](src/dev/repl.clj) we don't start the shadow watcher.
* In [app.cljs](src/main/acme/frontend/app.cljs) the `:dev/after-load` hook is added for hot reloading to be enabled out of the box.
  * We also make the app do something to the web page it is running in.
* In [shadow-cljs.edn](shadow-cljs.edn) the `:frontend` build has
  * a `:devtools` entry and used to enable hot reloading of css.
  * `:output-dir` and `:output-dir` entries are added. (These can be a bit tricky to get right when starting with shadow-cljs, is my experience.)
* In [deps.edn](deps.edn) we add an explicit dependency on version 1.12 of [Clojure](https://clojure.org). So that we know `add-libs` is available with fewer REPL restarts needed.
* As described in [Conveniences](#conveniences) above, the project uses [clj-reload](https://github.com/tonsky/clj-reload) for reloading of Clojure code.

## Happy coding! ❤️

Please consider [sponsoring my work on Calva](https://github.com/sponsors/PEZ).