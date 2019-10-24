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
  * Implement something like CIDER inspect: https://github.com/BetterThanTomorrow/calva/issues/228
  * Make it super easy to use Calva with REBL
* Fix the statusbar button default colors (or remove this feature if we don't think it is valuable enough).

## The Right Features
* Support clj-fmt indent settings.
* [x] Enable clj-kondo as default Calva linter ([clj-kondo](https://github.com/borkdude/clj-kondo/releases/tag/v2019.09.22-alpha) does support Windows but distributes no binary for Windows)
* Enable using nrepl in streaming mode
  * Use this for the test runner
* Add some basic refactorings support
* Use ”last opened in” column when opening the REPL window at jack in. (example? I do not fully understand.)
* Consider not opening the REPL window at jack-in / make it an option.
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
* We have two formatters, cljs-lib ormatter and the one in docmirror.
  * It mmight make sense to keep both for different purposes, but we should fix whatever it is that makes us still keep the `newIndentEngine` setting.
* Organize Calva functionality in ”components”, more like we do with calva-fmt, ParEdit, and Clojure Warrior.
* Get better control of Calva state.
* Clean up extra messy parts of the code. Candidates:
  * The evaluations module
  * The annotations module (this is particularly brittle)
