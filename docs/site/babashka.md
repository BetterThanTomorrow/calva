---
title: Babashka
description: Learn how to use Calva to get REPL powered Interactive Programming with Babashka, a civilized scripting language and task manager.
search:
  boost: 5
---

# Using Calva with Babashka

Since [Babashka](https://babashka.org) can be started such that it is an nREPL server, Calva can connect to it and a lot of the features will work.

Calva can also start Babashka and connect its REPL for you, using the Jack-in command.

!!! Note "Don't expect complete support"
    Babashka's nREPL server is still a bit limited compared to a full cider-nrepl enhanced "regular" Clojure nREPL server. Things like function signatures, and more do not work. 
    
    This might of course improve in the future, especially if you provide some PRs towards the Babashka nREPL.