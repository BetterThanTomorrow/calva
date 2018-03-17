# Change Log
Notable changes to CLojure 4 VS Code.

## [1,1.3] - 17.03.2018
- User setting to evaluate namespace on save/open file (defaults to **on**)

## [1.1.1] - 16.03.2018
- Relase of v1, based on **visual:clojure** v2.0, adding:
    - Running tests through the REPL connection, and mark them in the Problems tab
        - Run namespace tests: `alt+v t`
        - Run all tests: `alt+v a`
    - Evaluate code and replace it in the editor, inline: `alt+v e`
    - Error message when evaluation fails
    - Pretty printing evaluation resuls: `alt+v p`
    - Support for `cljc` files (this was supposed to be supported by the original extension, but bug)

