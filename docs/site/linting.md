# Linting

Calva does no linting, yet with Calva you get excellent linting. That is because Calva bundles the [clj-kondo](https://marketplace.visualstudio.com/items?itemName=borkdude.clj-kondo) extension, which is powered by the [linter with the same name](https://github.com/borkdude/clj-kondo).

You might want to read about [how to configure clj-kondo](https://github.com/borkdude/clj-kondo/blob/master/doc/config.md#configuration). These two sections might be of extra interest:

* [Exclude unresolved symbols from being reported](https://github.com/borkdude/clj-kondo/blob/master/doc/config.md#exclude-unresolved-symbols-from-being-reported)
* [Lint a custom macro like a built-in macro](https://github.com/borkdude/clj-kondo/blob/master/doc/config.md#lint-a-custom-macro-like-a-built-in-macro)

If you see clj-kondo squiggle the first character of the file with an error you don't quite understand, it is probably something wrong with your clj-kondo configuration.

The clj-kondo extension lints the current file as it is being edited. If you want to lint the whole project, use the clj-kondo cli command. See [https://github.com/borkdude/clj-kondo](https://github.com/borkdude/clj-kondo) for more info on that. Windows users might like to know that they too can get a clj-kondo cli command now, via [`npm install -g clj-kondo`](https://twitter.com/borkdude/status/1187622954236071936). It'll be a bit slower to start than the native build, but for sure it's better than not having a clj-kondo command! (Besides, the VS Code extension takes care of the cases where you really want speed.) See [https://github.com/borkdude/clj-kondo/blob/master/doc/install.md#npm-linux-macos-windows](https://github.com/borkdude/clj-kondo/blob/master/doc/install.md#npm-linux-macos-windows) for more on this.