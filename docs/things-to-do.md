# Things to be done with Calva

The major themes are:
* Documentation
* Squash Bugs
* The Right Features
* Development Workflow
* Code Maintainability

## Documentation
* Video, How to get started with Calva, to support the text on the wiki
* The Calva settings (which ones are not documented on the wiki?)
* Replace some outdated GIFs used in the README.
* Make clear what Calva is about, what stances it takes and where it is heading

## Squash Bugs
* The test runner sometimes just doesn't work
* The REPL window can't handle large output. Ideas:
  * Fix the performance issues (might be a tricky job)
  * Truncate large output in the REPL window and print it in an untitled Clojure-enabled editor window instead.
  * Alternative approach:
    * Integrate the [Monaco Editor](https://microsoft.github.io/monaco-editor/) on which the whole vscode thing is based on in two ways
      * As the editing area on the bottom 
      * As a readonly content display of the output
    * This should probably fix some performance issues
    * This should improve the editing capabilities of the editing area
    * All language spezific support (formating, rainbowcolors, intellisense, etc) should be integratable in the editor.
* Fix the statusbar button default colors (or remove this feature if we don't think it is valuable enough).

## The Right Features
* Support clj-fmt indent settings.
* Enable clj-kondo as default Calva linter
* Enable using nrepl in streaming mode
  * Use this for the test runner
* Add some basic refactorings support
* Use ”last opened in” column when opening the REPL window at jack in.
* Consider not opening the REPL window at jack-in.
* Bettter connection life-cycle control fo shadow-cljs. Either:
  1. Tap in to the shadow message bus (THeller said that there is such a thing that we can quyery about what shadow-cljs is doing.)
  1. Run Jack-in in a Task proper and see if we can somehow catch the output. (This is needed for shadow-cljs Jack-in.)
* Consider supporting REBL out-of-the-box.
* Add more Calva extension context statuses and use it for more precise command and shortcut enablements.
* A way to get output pasted in a Clojure-enabled editor window.

## Development Workflow
* Write a basic smoke test checklist
* Write an issues template
* Get a unit test framework in place for the TypeScript code base.
* Get an integration test framework in place, for automatic smoke testing.

## Code Maintainability
* We have two ParEdit implementations, we should scrap paredit.js
* Organize Calva functionality in ”components”, more like we do with calva-fmt, ParEdit, and Clojure Warrior.
* Get better control of Calva state.
* Clean up extra messy parts of the code. Candidates:
  * The evaluations module
  * The annotations module (this is particularly brittle)
