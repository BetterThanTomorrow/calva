---
title: Reveal
description: Read Eval Visualize Loop for Clojure. How to use Calva and Reveal together
---

# How to use Calva and Reveal together

[Reveal](https://vlaaad.github.io/reveal) is a "Read Eval Visualize Loop for Clojure". This page describes how to use Reveal in your development setup based on Calva.

!!! Note
    See [https://vlaaad.github.io/reveal](https://vlaaad.github.io/reveal) for the latest version and use that wherever this page says `<version>`.

## When using tools.deps

You can go for the nrepl middleware or just add the dependency. 

Please see the Calva test-data project [minimal-reveal](https://github.com/BetterThanTomorrow/calva/blob/published/test-data/projects/minimal-reveal/) for an example.

### Middleware

This will make Reveal to start together with your project.

!!! Note
    This will make all Calva evaluations go to Reveal. Too chatty for you? Take the _dependencies only_ approach.


Add this alias `deps.edn`:

```clojure
:aliases
{:reveal-nrepl-middleware
    {:extra-deps {vlaaad/reveal {:mvn/version "<version>"}}
     :main-opts  ["-m" "nrepl.cmdline"
                  "--middleware" "[vlaaad.reveal.nrepl/middleware,cider.nrepl/cider-middleware]"]}}

```

And then jack-in choosing the deps.edn option and then pick the `:reveal-nrepl-middleware` alias.

### Dependencies only

If you don't want to use the nrepl-middleware you can configure just the dependency and then start Reveal yourself.

The alias:

```clojure
:reveal-dep-only
  {:extra-deps {vlaaad/reveal {:mvn/version "<version>"}}}
```

A custom REPL command for starting Reveal in your project:

```json
    "calva.customREPLCommandSnippets": [
        ...
        {
            "name": "Start Reveal Tapper",
            "snippet": "(require '[vlaaad.reveal :as reveal])(add-tap (reveal/ui))",
            "key": "sr"
        },
        ...
    ]
```

See [Custom REPL Command](custom-commands.md) for how to configure more commands, and bind shortcuts to them, to make Reveal integration nice for you.


## When using Leiningen

In your `project.clj`, add a profile named "reveal":

```clojure
:profiles {:reveal {:dependencies [[vlaaad/reveal "<version>"]]
                    :repl-options {:nrepl-middleware [vlaaad.reveal.nrepl/middleware]}}}
```

Now when you jack-in using Calva, you enable this profile and Reveal will be
started automatically. Please note that Reveal requires Java 8 or higher, and
uses JavaFX. Depending on your setup, you may need to make sure it is available.

## Tips about font size
If you find the font to small you can add a `:jvm-opts` key to make it a little bigger:

```clojure
:aliases
{:reveal
    {:extra-deps {vlaaad/reveal {:mvn/version "<version>"}}
     :jvm-opts   ["-Dvlaaad.reveal.prefs={:font-size,17}"]
     :main-opts  ["-m" "nrepl.cmdline"
                  "--middleware" "[vlaaad.reveal.nrepl/middleware,cider.nrepl/cider-middleware]"]}}

```

## Using Java > 11?

Reveal needs some reflective access to internal classes that has since Java 11 been restricted. You can relax this and get things working via JVM options. Tuck this into your reveal alias:

```edn
:jvm-opts ["--add-opens" "javafx.graphics/com.sun.javafx.tk=ALL-UNNAMED"]
```

(If you are using the font size tips, just add the options into the `:jvm-opts` vector.)

See [https://github.com/vlaaad/reveal/issues/1](https://github.com/vlaaad/reveal/issues/1) for some more context around this issue.