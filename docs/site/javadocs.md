---
title: Javadoc support in Calva
description: 
---
Calva's javadoc support is inherited from nrepl, so similar to the support for javadoc in Cider.

In principle javadoc is shown full automatically via popups when
hovering over java functions and classes.

# Prerequisites

In order to have this work best, four conditions need to be fulfilled.

1. The java library we want to see javadoc for need to be referred to in `deps.edn`

2. The Java classes we want javadoc for, need to be made available in the repl via `import` 

3. In lots of situation the dynamic nature of Clojure does not allow to statically discover what runtime class a symbol has, which often prevents the showing of javadocs. If **type hints** are specified, it works in most cases. Note: Adding type hints improves as well the precision of code completion proposals on Java instances

4. Important: nrepl/Calva extracts the javadoc information from local disk, specifically looking for "source jars" in the folder `.m2/repository `. These are not downloaded by Clojure automatically. (it only downloads the code jars for referred java libraries)
For the JDK itself, very often the source files are installed locally with the JDK. So in a lot of cases the javadocs for JDK classes works out-of-the box. (but it depends on the precise JDK/JRE installation)

The easiest way to make sure, that the "source jars" are available locally for non JDK classes, is to use "maven" to download them. For all java libraries referred by the current `deps.edn` this can be achieved with a single command:


```
clojure -X:deps mvn-pom && mvn dependency:sources'
```

This will download all available source jars of the current java libraries of `deps.edn` and store them in `.m2` where nrepl / Calva will find them.

Most Java open source libraries publish "source jars" in maven central, and the command above will usually find and download them all.
After repl restart, javadocs should now popup in lots of situations when using Clojure Java Interop code (it works far more often, when type hints are added)

In case new Java libraries get added to `deps.edn`, the command need to be repeated.

# Alternative for type hints since Clojure 1.12

Clojure has two ways of calling a Java method on a given instance:

Since the beginning:
```
(def text "hello world")
(.charAt text 0)
```

Since Clojure 1.12 additionally:
```
(def text "hello world")
(String/.charAt text 0)
```

nrepl / Calva does understand already the new syntax, and if used, the javadoc support will work even without type hints, in all situations.


