# Calva Syntax Highlight Grammar

Calva Format's `clojure.tmLanguage.json` file is built from here (the `/grammars/clojure.cson` file). When making changes, also update `spec/clojure-spec.coffee` and make sure all tests pass.

To run the tests you need to open this directory in Atom and issue the **Run Package Specs** command.

To test your changes on CLojure source files in Atom you need to link this directory to where Atom keeps its dev package files. This works on Mac and Linux:

```sh
$ cd ~/.atom/dev/packages
$ ln -s <some-path>/calva-fmt/atom-language-clojure/ language-clojure
```

You also need to run Atom in dev mode:

```sh
$ atom -d
```

When all old and new tests pass, update Calva Format's grammar from the root of the project:

```sh
$ npm run update-grammar
```

Then make some sanity tests on Clojure source files in VS Code (this mainly tests that the update-grammar script works, but anyway).
