---
title: REPL hot-reload Java code with Virgil
description: REPL driven development of mixed Clojure / Java projects using Virgil
---

# Mixed Clojure / Java projects

## Mixed builds
Combined Java and Clojure projects where possible from the first day of Clojure.
The official Clojure documentation describes 
[here](https://clojure.org/guides/tools_build#_mixed_java_clojure_build) such a 
setup incl. a `build.clj`

For Leiningen we have a similar setup documented [here](https://github.com/technomancy/leiningen/blob/github/doc/MIXED_PROJECTS.md) .

## Java development in VSCode
VSCode has good [first class support](https://code.visualstudio.com/docs/languages/java) for Java.

So we have

* a "mixed build" 
* comfortable editing of Clojure code with VSCode/Calva
* comfortable editing of Java source code with VSCode/Java extensions

but these do not address a REPL driven workflow spanning changing Clojure and Java files.

## Virgil

For quite a while, there was no real answer, as any change to a Java class required
the restart of the REPL, which is not a smooth workflow.

[Virgil](https://github.com/clj-commons/virgil) has changed this !

Virgil is a small Clojure library which continuously watches your java source files and recompiles them on each change and loads the changed classes into the running Clojure JVM.

This allows side-by-side development of Java and Clojure code and Virgil makes sure that the Clojure JVM gets the changed Java files injected.
