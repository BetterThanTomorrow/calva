# Change Log
Notable changes to CLojure 4 VS Code.

## [1.1.20] - 25.03.2018
- Auto detection of forms to evaluate now condiders reader macro characters prepending the forms. E.g. before if you tried to evaluate say `#{:a :b :c}` with the cursor placed directly adjacent to the starting or ending curly braces only `{:a :b :c}` would be autodetected and evaluated.
- Highlighting of auto detected forms being evaluated.
- Rendering evaluation errors in the editor the same way as successful (but in red to quickly indicate that the evaluation errored).

![Evaluation demo](/assets/howto/evaluate.gif)

## [1.1.15] - 20.03.2018
- Evaluates vectors and maps with the same ”smart” selection as for lists.

## [1.1.11] - 20.03.2018
- Add inline annotations for interactive code evaluation results.

## [1.1.9] - 18.03.2018
- Add toggle for switching which repl connection is used for `cljc` files, `clj` or `cljs`.

![CLJC repl switching](/assets/howto/cljc-clj-cljs.gif)

- `clj` repl connected to all file types, meaning you can evaluate clojure code in, say, Markdown files.


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

