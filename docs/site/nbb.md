---
title: nbb
description: Calva has great support for Interactive Programming with nbb. Start a session from Calva, or connect to a running nbb nREPL server
search:
  boost: 4
---

# Using Calva with nbb

Since [nbb](https://github.com/borkdude/nbb) can be started such that it is an nREPL server, Calva can connect to it and a lot of the features will work.

Calva can also start nbb and connect its REPL for you, using the Jack-in command. This will start an nbb nREPL server on a random port and connect Calva to it. Check out this video where they use Calva and nbb to create a CLI tool as an executable npm module:

<iframe width="560" height="315" src="https://www.youtube.com/embed/_-G9EKaAyuI" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

In that video they ask for a JavaScript to ClojureScript converter. And there is one: https://mauricioszabo.gitlab.io/js2cljs/

Though if you are using Calva, this converter is easier to use directly via the command **Calva: Convert JavaScript to ClojureScript**:

<iframe width="560" height="315" src="https://www.youtube.com/embed/bMU2GhucLXc" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    
!!! Note "Errors jacking in to nbb on Windows?"
    On some machines it seems necessary to first run `npx nbb` from the `CMD` prompt to make jack-in work. Or try first install it `npm i -g nbb`. (You probabl want nbb installed globally anyway.)

!!! Note "Don't expect complete support"
    nbb's nREPL server is completely new and and WIP. It will be a bit limited compared to a full cider-nrepl enhanced "regular" Clojure nREPL server. Things like function signatures, and more do not work.

!!! Note "It's a bit hacky"
    The nbb nREPL server is the first ClojureScript nREPL server around and throws Calva's assumption that an nREPL server is always started in a Clojure process out the window. The nbb Jack-in/connect option ”pretends” it is connecting to a Clojure nREPL and then the code fro promoting the nREPL session to a ClojureScript one is just dummy code.

    This means that if you open a Clojure (`.clj`) file while connected to an nbb nREPL server, it will still be a ClojureScript session serving even though Calva will indicate that it is a Clojure one. Bare with us until we can fix this properly in Calva.