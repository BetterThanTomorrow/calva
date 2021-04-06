# Clojure-lsp

Calva uses a mix of static and dynamic analysis to power the experience. A lot of the static abilities come from [clojure-lsp](https://github.com/snoe/clojure-lsp). This enables you to check something up in a project, with a lot of navigational and contextual support, without starting a REPL for it. (And once you do start a REPL you'll get even more capabilities, enabled by the dynamic analysis.)

## Starting the LSP server

You don't need to do anything to start clojure-lsp. No install, no commands, no nothing. Calva downloads the correct binary for your operating system if necessary (this should only happen when the clojure-lsp version is updated in a new release of Calva) and then starts it. It does take a while for clojure-lsp to start, though, especially the first time for a new project, when clojure-lsp (via `clj-kondo`) indexes the project files.

Calva will show a status bar message during the download and while the server is starting, which will go away once the server is ready. However, _much of Calva's functionality is available regardless of the LSP server_, so please start using Calva while this server is starting.

!["Clojure-lsp status bar downloading and intializing messages"](images/clojure-lsp/lsp-status-bar-message.gif "Clojure-lsp status bar downloading and intializing messages")

## Ignoring LSP cache files

Clojure-lsp stores its project analysis information in your project. Git users can add these lines to their project root directory `.gitignore`:

```
.clj-kondo/cache/
.clj-kondo/.cache/
.lsp/sqlite.*.db
```

## Troubleshooting

If something doesn't seem to be working correctly, and you suspect the issue is related to clojure-lsp, a good place to start investigating is the request and response logs between the LSP client and server. In your settings, set `Clojure > Trace: Server` to `versbose`, then in the VS Code output tab, select the `Clojure Language Client` output channel.

!["Clojure trace server setting"](images/clojure-lsp/trace-server-setting.png "Clojure trace server setting")

It may be helpful to clear the output channel, then perform the action with which you're experiencing a problem, then read through the log for clues or paste the logs into a related issue in the Calva repo.

## Related

See also:

* [Connecting the REPL](connect.md)
* [Refactoring](refactoring.md)
