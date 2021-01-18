# How to use Calva and Reveal together

[Reveal](https://vlaaad.github.io/reveal) is a "Read Eval Visualize Loop for
Clojure". This page describes how to use Reveal in your development setup based
on Calva.

## When using Leiningen

In your `project.clj`, add a profile named "reveal":

```clojure
:profiles {:reveal {:dependencies [[vlaaad/reveal "1.2.185"]]
                    :repl-options {:nrepl-middleware [vlaaad.reveal.nrepl/middleware]}}}
```

Now when you jack-in using Calva, you enable this profile and Reveal will be
started automatically. Please note that Reveal requires Java 8 or higher, and
uses JavaFX. Depending on your setup, you may need to make sure it is available.

## When using tools.deps

In your project's `deps.edn` file add a `:reveal` alias:

```clojure
:aliases
{:reveal
    {:extra-deps {vlaaad/reveal {:mvn/version "1.2.185"}}
     :main-opts  ["-m" "nrepl.cmdline"
                  "--middleware" "[vlaaad.reveal.nrepl/middleware,cider.nrepl/cider-middleware]"]}}

```

And then jack-in choosing the Clojure CLI option and then pick the `:reveal` alias.

If you find the font to small you can add a `:jvm-opts` key to make it a little bigger:

```clojure
:aliases
{:reveal
    {:extra-deps {vlaaad/reveal {:mvn/version "1.2.185"}}
     :jvm-opts   ["-Dvlaaad.reveal.prefs={:font-size,17}"]
     :main-opts  ["-m" "nrepl.cmdline"
                  "--middleware" "[vlaaad.reveal.nrepl/middleware,cider.nrepl/cider-middleware]"]}}

```
