# Linting

Calva does no linting at all. However, it bundles the [clj-kondo](https://marketplace.visualstudio.com/items?itemName=borkdude.clj-kondo) extension, which is powered by the [linter with the same name](https://github.com/borkdude/clj-kondo).

You might want to read about [how to configure clj-kondo](https://github.com/borkdude/clj-kondo/blob/master/doc/config.md#configuration). These two sections might be of extra interest:
* [Exclude unresolved symbols from being reported](https://github.com/borkdude/clj-kondo/blob/master/doc/config.md#exclude-unresolved-symbols-from-being-reported)
* [Lint a custom macro like a built-in macro](https://github.com/borkdude/clj-kondo/blob/master/doc/config.md#lint-a-custom-macro-like-a-built-in-macro)

If you see clj-kondo squiggle the first character of the file with an error you don't quite understand, it is probably something wrong with your clj-kondo configuration. One such error could be from not knowing this: _Note that the symbols in the clj-kondo configuration need to be fully qualified, with namespaces._