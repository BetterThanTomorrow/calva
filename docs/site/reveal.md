# How to use Calva and Reveal together

[Reveal](https://vlaaad.github.io/reveal) is a "Read Eval Visualize Loop for
Clojure". This page describes how to use Reveal in your development setup based
on Calva.

## When using Leiningen

In your `project.clj`, add a profile named "reveal":

```clojure
:profiles {:reveal {:dependencies [[vlaaad/reveal "1.1.164"]]
                    :repl-options {:nrepl-middleware [vlaaad.reveal.nrepl/middleware]}}}
```

Now when you jack-in using Calva, you enable this profile and Reveal will be
started automatically. Please note that Reveal requires Java 8 or higher, and
uses JavaFX. Depending on your setup, you may need to make sure it is available.

## When using tools.deps

_TODO: this needs to be figured out too. Probably going by the [Reveal
instructions](https://vlaaad.github.io/reveal/#nrepl-based-editors) will do the
trick. Please [submit a PR](https://github.com/BetterThanTomorrow/calva/pulls)
if you know how to do this!_
