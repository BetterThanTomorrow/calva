# Clojure-lsp

Calva uses a mix of static and dynamic analysis to power the experience. A lot of the static abilities come from [clojure-lsp](https://github.com/snoe/clojure-lsp). This enables you to check something up in a project, with a lot of navigational and contextual support, without starting a REPL for it. (And once you do start a REPL you'll get even more capabilities, enabled by the dynamic analysis.)

!!! Note
    Calva determines the version of clojure-lsp it uses by default. This means it may not be using the latest version of clojure-lsp. You can see what version is being used by running the `Clojure-lsp Server Info` command, which will also show the version of clj-kondo that's being used as well as other info. To use a different version of clojure-lsp, see the [configuration](#configuration) section. **Calva does not use the clojure-lsp installed on your system, unless you [set the path for clojure-lsp](#using-a-custom-clojure-lsp-native-binary) to the installed binary in your settings**.

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

## Configuration

For information about how to configure clojure-lsp, see the [settings](https://clojure-lsp.github.io/clojure-lsp/settings/) page of the clojure-lsp docs.

### Changing the Version of Clojure-lsp Used by Calva

You can change the version of clojure-lsp used by Calva by setting the `calva.clojureLspVersion` property to a version of clojure-lsp found in its GitHub [releases](https://github.com/clojure-lsp/clojure-lsp/releases). This can be helpful if you're debugging an issue with clojure-lsp or you want to try out a feature of a new release that Calva does not yet use. However, you must remember to reset this setting in order for Calva to automatically use newer versions of clojure-lsp that are released with new versions of Calva.

Example:

```json
"calva.clojureLspVersion": "2021.04.07-16.34.10"
```

### Using a Custom Clojure-lsp Native Binary

You can set a path to a clojure-lsp binary to be used by Calva by setting the `calva.clojureLspPath` setting. This should be an absolute path. When this is set, the binary at the path will be used and the `calva.clojureLspVersion` setting will be ignored.

Example:

```json
"calva.clojureLspPath": "/usr/local/bin/clojure-lsp"
```

## Troubleshooting

If something doesn't seem to be working correctly, and you suspect the issue is related to clojure-lsp, a good place to start investigating is the request and response logs between the LSP client and server. In your settings, set `clojure.trace.server` to `verbose`, then in the VS Code output tab, select the `Clojure Language Client` output channel.

!["Clojure trace server setting"](images/clojure-lsp/trace-server-setting.png "Clojure trace server setting")

It may be helpful to clear the output channel, then perform the action with which you're experiencing a problem, then read through the log for clues or paste the logs into a related issue in the Calva repo.

### Server Info Command

You can run the `Clojure-lsp Server Info` command to get information about the running clojure-lsp server, such as the version being used, the version of clj-kondo it's using, and more.

## Related

See also:

* [Connecting the REPL](connect.md)
* [Refactoring](refactoring.md)
