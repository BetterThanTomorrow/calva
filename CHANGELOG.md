# Change Log
All notable changes to the "visual:clojure" extension will be documented in this file.

## [Pre-releases 0.1]
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
