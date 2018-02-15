# Change Log
All notable changes to the "visual:clojure" extension will be documented in this file.

## [2.0.0] - 15.02.2018
- Relase of v2.0
- Major rewrite of codebase
- Added support for:
    - Formatting clj and cljs using cljfmt
    - Linting clj and cljs using joker
        - No longer using nrepl/cider for errors as this proved unreliable and troublesome to parse
    - Auto-connect, and reconnect using .nrepl-port file in project
    - Reworked keybindings, using prefix `alt+v` command
        - `alt+v c` connect
        - `alt+v r` reconnect
        - `alt+v l` lint file
        - `alt+v e` eval sexp / selection
        - `alt+v enter` eval file
    - Improved hover and signature markdown / apperance
    - Added immutable and cursor for more sane state-management

## [Pre-releases]

## [0.0.2] - 11.03.2017
### Added
* Initial readme/howto

### Fixed
* Now properly connects to a pure Clojure REPL

### Removed
* Annoying warning-msg when the current file is not supported by the connected REPL.

## [0.0.1] - Initial release
### Added
* Most of the basic functionality now kinda works for both clj and cljs
    * Connect to existing nREPL and determine if it is running a cljs-session. Default shortcut: alt+c
        * Supports and stores both cljs and clj sessions, using the appropriate one for ops based on file-extension
        * cljs -> cljs-session
        * clj and cljc -> clj-session
    * Evaluate file from command (automatically on open, save, and change). Default shortcut: alt+f5
    * Evaluate expression from command (selected block, selected parenthesis). Default shortcut: alt+Enter
    * Arguments and document-string on mouse-over
    * Definition on ctrl+mouseover, go to definition on f12, peek: alt+f12
    * Auto-completion/'intellisense'
    * Very limited snippets (only console.log, defn, and defn- supported so far)
