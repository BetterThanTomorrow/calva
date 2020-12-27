# clojure-lsp

Calva uses a mix of static and dynamic analysis to power the experience. A lot of the static abilities come from [clojure-lsp](https://github.com/snoe/clojure-lsp). This enables you to check something up in a project, with a lot of navigational and contextual support, without starting a REPL for it. (And once you do start a REPL you'll get even more capabilities, enabled by the dynamic analysis.)

## Starting the LSP server

You don't need to do anything to start clojure-lsp. No install, no commands, no nothing. It does take a while for clojure-lsp to start, though, especially the first time for a new project, when clojure-lsp (via `clj-kondo`) indexes the project files.

Calva will show a progress notification while the server is starting, which will go away once the LSP is ready to serve. However: _Most of Calva's functionality is available regardless of the LSP server_, so please start using Calva while this server is starting.

![](images/lsp-starting.gif)


## Ignoring LSP cache files

clojure-lsp stores its project analysis information in your project. Git users can add these lines to their project root directory `.gitignore`:

```
.clj-kondo/cache/
.clj-kondo/.cache/
.lsp/sqlite.*.db
```

## Related

See also:

* [Connecting the REPL](connect.md)
* [Refactoring](refactoring.md)
