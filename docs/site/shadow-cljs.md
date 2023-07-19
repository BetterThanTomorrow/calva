---
title: shadow-cljs
description: Calva ♥️ shadow-cljs
search:
  boost: 7
---

Calva supports most any JVM hosted ClojureScript environment (and some others, including SCI based, too), but shadow-cljs gets some special treatment to try make it extra convenient to use.

With many shadow-cljs projects, Calva's _connect project type_ **shadow-cljs**, is the right choice. Projects that use Leiningen or deps.edn can be used both with the **Leiningen/deps.edn** _and_ **shadow-cljs** type, depending on configuration see [below](#shadow-cljs-in-full-stack-projects) for more on this.


# shadow-cljs - browser quickstart

Here's how you start a shadow-cljs ClojureScript REPL and connect Calva with the [shadow-cljs - browser quickstart](https://github.com/shadow-cljs/quickstart-browser) example project:

**Prep**:

0. Clone the project to your machine and open its root folder in VS Code.
1. Open a terminal and run `npm install`

**Connect Calva**:

1. Run the command **Calva: Start a Project REPL and Connect (a.k.a. Jack-in)**
1. Select project type **shadow-cljs**
1. Select to start the build **:app**
1. Select to connect to the build **:app**
1. Wait for the build to complete
1. Open http://localhost:8020/ in the browser
1. Open browser.cljs file and load it in the REPL: **Calva: Load/Evaluate Current File and Dependencies**

Now you can should be able to evaluate forms, e.g.:

* The current form or selection with <kbd>ctrl</kbd>+<kbd>enter</kbd>, or
* Top-level forms with <kbd>alt/option</kbd>+<kbd>enter</kbd>.

(See [Code Evaluation](evaluation.md))

# shadow-cljs in full stack projects

**shadow-cljs** is a bit special in regards to Calva REPL connection. Mainly because you can start **shadow-cljs** and it's nREPL server in two ways:

1. Using the **shadow-cljs** npm executable
2. Via the Clojure REPL in your Leiningen or **deps.edn** project

These options show up as **project types** when connecting or jacking in:

1. Project type: **shadow-cljs**
2. Project type: **deps.edn + shadow-cljs** or **Leiningen + shadow-cljs**

The technical difference here is wether you let **shadow-cljs** start **clojure**/**Leiningen** (the first option) or if you let Calva do it (the second option). If you let Calva do it, Calva will then start the **shadow-cljs** watcher from the Clojure process. From a usage perspective the two approaches will result in different channeling of **shadow-cljs** output, e.g. test runner results. With the first option (the **shadow-cljs** project type), **shadow-cljs** output will be channeled to the **Jack-in** terminal. With the **deps.edn**/**Leiningen** option, that output will be channeled to the Output/REPL window.

See [shadow-cljs + Clojure with Calva: The basics](https://blog.agical.se/en/posts/shadow-cljs-clojure-cljurescript-calva-nrepl-basics/) for some more discussion on how the REPL connection works.

!!! Note "shadow-cljs and `clojure` aliases"
    The **shadow-cljs** project type will not prompt you for any aliases found in the `deps.edn` file. Usually you should provide such aliases in `shadow-cljs.edn` like `:deps {:aliases [...]}`. If, for whatever reason you can't provide the aliases that way, you can configure a [Custom REPL Connect Sequence](connect-sequences.md) and provide the aliases as `menuSelections` -> `cljAliases`.

!!! Note "Leiningen + shadow-cljs middleware issue"
    Please note that for Leiningen, [the command line dependency injection of the shadow-cljs nrepl middleware doesn't work](https://codeberg.org/leiningen/leiningen/issues/10). You need to add it to your `project.clj`:

    ```clojure
    :repl-options {:nrepl-middleware [shadow.cljs.devtools.server.nrepl/middleware]}
    ```

# See also:

* [Connect the REPL](connect.md)
* [Custom REPL Connect Sequences](connect-sequences.md)
* [shadow-cljs + Clojure with Calva: The basics](https://blog.agical.se/en/posts/shadow-cljs-clojure-cljurescript-calva-nrepl-basics/)