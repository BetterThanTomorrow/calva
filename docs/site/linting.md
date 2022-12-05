---
title: Superb Clojure Linting
description: Powered by clj-kondo, Calva comes with state-of-the-art Clojure and ClojureScript linting
---

# Linting

Calva does no linting, yet with Calva you get excellent linting. That is because Calva uses [clojure-lsp](https://github.com/clojure-lsp/clojure-lsp), which provides linting powered by clj-kondo.

clj-kondo comes with great default rules, and the configuration [can be customized](https://github.com/clj-kondo/clj-kondo/blob/master/doc/config.md). One of your options for the configuration file is to  placed a `config.edn` file in `.clj-kondo/` at the root of your project. This folder may or may not already exist. It is safe to create it manually if it doesn't.

The configuration will be merged with the default set of rules, you can only specify the rules you want to override. The full list of available options can be found on [clj-kondo's github](https://github.com/clj-kondo/clj-kondo/blob/master/doc/linters.md)

clojure-lsp is customizable, see [Clojure LSP Settings](https://clojure-lsp.io/settings/) for your options. It is safe to manually create the `.lsp` folder if it doesn't exist.

You might want to read about [how to configure clj-kondo](https://github.com/borkdude/clj-kondo/blob/master/doc/config.md#configuration). These two sections might be of extra interest:

* [Unrecognized macros](https://github.com/clj-kondo/clj-kondo/blob/master/doc/config.md#unrecognized-macros)
* [Lint a custom macro like a built-in macro](https://github.com/borkdude/clj-kondo/blob/master/doc/config.md#lint-a-custom-macro-like-a-built-in-macro)

If you see a linting squiggle under the first character of the file with an error you don't quite understand, it is probably something wrong with your clj-kondo configuration.

Files are linted as they're being edited. If you want to lint the whole project, use the clj-kondo cli command. See [https://github.com/borkdude/clj-kondo](https://github.com/borkdude/clj-kondo) for more info on that. Windows users might like to know that they too can get a clj-kondo cli command now, via [`npm install -g clj-kondo`](https://twitter.com/borkdude/status/1187622954236071936). It'll be a bit slower to start than the native build, but for sure it's better than not having a clj-kondo command! See [https://github.com/borkdude/clj-kondo/blob/master/doc/install.md#npm-linux-macos-windows](https://github.com/borkdude/clj-kondo/blob/master/doc/install.md#npm-linux-macos-windows) for more on this.

## Resolve Macro As

When your cursor is on a macro form in the editor, you may notice a code action (click the light bulb that appears) called Resolve Macro As. Running this code action will ask you what macro you'd like to resolve the current macro as, and then what clj-kondo config file you want the macro to be saved to. This code action is also available as a command.