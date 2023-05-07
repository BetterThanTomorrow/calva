---
title: Customize Jack-in and Connect
description: Calva's connecting of the REPL is highly customizable
search:
  boost: 7
---

# Customize Jack-in and Connect

 Since Jack-in and connect both are about connecting the REPL, and only differ in how the REPL is started, many settings and configuration points are shared between the two concepts. A major customization point is [Custom Connect Sequences](connect-sequences.md), which are relevant for both Jack-in and Standalone Connect scenarios.

This page lists some more Jack-in and Connect configuration options.

## Auto-evaluate Code on Connect

You can have Calva evaluate code whenever a REPL has been connected via the `calva.autoEvaluateCode.onConnect` setting. It has two entries `clj` and `cljs`:

- `clj`: "Code to evaluate when the **Clojure** REPL has been connected.
    - The default is code that refer in the `repl-requires`/REPL utilities (like `source`, `doc`, etcetera). (Note that there is also a command to do this on demand.).
    - The code will be evaluated *before* the `afterCLJReplJackInCode` in any [connect sequence](https://calva.io/connect-sequences/) used.
    - Set to `null` to disable this feature. (The Settings linter will complain, but it works.)
- `cljs`: Code to evaluate when the **ClojureScript** REPL has been connected.
    - The default is code that refer in the `repl-requires`/REPL utilities (like `source`, `doc`, etcetera). (Note that there is also a command to do this on demand.).
    - Set to `null` to disable this feature.

NB: There are two mechanisms for evaluating code when a Clojure REPL is connected. The `afterCLJReplJackInCode` setting of custom connect sequences, and this `calva.autoEvaluateCode.onConnect.clj` setting. There is no fundamental difference between them. This one has a default function of auto-refering in the Clojure REPL utilities. And it will be run *before* the connect sequence after-Jack-in code.

## Auto-evaluate Code at file/namespace load/evaluation

You can also make Calva auto-evaluate code when a file has been loaded (manually using the Calva command for it) in the REPL. You add code for this via the `calva.autoEvaluateCode.onFileLoaded` setting. It also has two entries: `clj` and `cljs`, for the **Clojure** and **ClojureScript** REPL, respectively.

Note that the same substitution variables as with [custom commands](https://calva.io/custom-commands/) can be used here.

Calva's does not provide defaults for this setting.

## Customizing Connect

If there is an nRepl port file, Calva will use it and not prompt for `host:port` when connecting. You can make Calva prompt for this by setting the boolean config `calva.autoSelectNReplPortFromPortFile` to `false`.

With the setting `calva.autoConnectRepl` you can make Calva automatically connect the REPL if there is an nRepl port file present when the project is opened.

With this and the below mentioned auto-select options you can make connect a prompt-less experience. See: [Connect Sequences](connect-sequences.md).

#### Options for the Connect Command 

The `calva.connect` command takes an optional options argument defined like so:

```typescript
  options?: {
    host?: string;
    port?: string;
    connectSequence?: string | ReplConnectSequence;
    disableAutoSelect?: boolean;
  }
```

Where `ReplConnectSequence` is a [Connect Sequences](connect-sequences.md). If you provide a string it needs to match against a built-in or custom connect sequence. With `disableAutoSelect` you can force the connect menus to be provided even if a custom connect sequence is set to be autoSelected.

You can provide these options from keyboard shortcuts or from [Joyride](https://github.com/BetterThanTomorrow/joyride) scripts.

Here's a keyboard shortcut for connecting to a running REPL bypassing any connect sequence with `autoSelectForConnect`.

```json
    {
        "command": "calva.connect",
        "args": {"disableAutoSelect": true},
        "key": "ctrl+alt+c shift+c",
    },
```

A Joyride command for connecting to a REPL on port 55555, without being asked for project type:

```clojure
(vscode/commands.executeCommand "calva.connect" (clj->js {:port "55555" :connectSequence "Generic"}))
```

## Customizing Jack-in
The main mechanism for customizing your Jack-in, including automating menu selections, and custom CLJS REPL types is [Custom Connect Sequences](connect-sequences.md).

There are also these settings:

* `calva.jackInEnv`: An object with environment variables that will be added to the environment of the Jack-in process.
* `calva.myCljAliases`: An array of `deps.edn` aliases not found in the project file. Use this to tell Calva Jack-in to launch your REPL using your user defined aliases.
* `calva.myLeinProfiles`: An array of Leiningen profiles not found in `project.clj`. Use this to tell Calva Jack-in to launch your REPL using your user defined profiles.
* `calva.openBrowserWhenFigwheelStarted`: _For Legacy Figwheel only._ A boolean controlling if Calva should automatically launch your ClojureScript app, once it is compiled by Figwheel. Defaults to `true`.
* `calva.depsEdnJackInExecutable`: A string which should either be `clojure` or `deps.clj`, or `clojure or deps.clj` (default). It determines which executable Calva Jack-in should use for starting a `deps.edn` project. With this setting at its default, `clojure or deps.clj`, Calva will test if the `clojure` executable works, and use it if it does, otherwise `deps.clj` will be used, which is bundled with Calva.

!!! Note
    When processing the `calva.jackInEnv` setting you can refer to existing ENV variables with `${env:VARIABLE}`.

### Options for the Jack-in Command 

The `calva.jackIn` command takes an optional options argument defined like so:

```typescript
  options?: {
    connectSequence?: string | ReplConnectSequence;
    disableAutoSelect?: boolean;
  }
```

Where `ReplConnectSequence` is a [Connect Sequences](connect-sequences.md). If you provide a string it needs to match against a built-in or custom connect sequence. With `disableAutoSelect` you can force the jack-in menus to be provided even if a custom connect sequence is set to be autoSelected.

You can provide these options from keyboard shortcuts or from [Joyride](https://github.com/BetterThanTomorrow/joyride) scripts.

Here's a keyboard shortcut for connecting to a running REPL bypassing any connect sequence with `autoSelectForConnect`.

```json
    {
        "command": "calva.jackIn",
        "args": {"disableAutoSelect": true},
        "key": "ctrl+alt+c shift+j",
    },
```

A Joyride command for starting a `deps.edn` REPL for a project in the root of the workspace.

```clojure
(vscode/commands.executeCommand
 "calva.jackIn"
 (clj->js {:connectSequence {:projectType "deps.edn"
                             :projectRootPath ["."]}}))
```

It will prompt for any aliases it finds in the `deps.edn` file.    

## Starting the REPL from application code?

If your project is setup so that the REPL server is started by the application code, you will need to get the cider-nrepl middleware in place. See the cider-nrepl docs about [embedding nREPL in your application](https://docs.cider.mx/cider-nrepl/usage.html#via-embedding-nrepl-in-your-application).

## Auto-select Project Type and Project Root

You can make both Jack-in and Connect stop prompting you for project type and project root path in projects where you always want to use the same. See [Connect Sequences](connect-sequences.md).

## Project roots search globing

When searching for project roots in your workspace, Calva will glob for all files matching `project.clj`, `deps.edn`, or `shadow-cljs.edn`. This is done using VS Code's workspace search engine, and is very efficient. However, in a large monorepo, it is still a substantial task. In order to not waste resources Calva will exclude any directories in the setting `calva.projectRootsSearchExclude`. 

![calva.projectRootsSearchExclude setting](images/calva-project-roots-search-exclude.png)

!!! Note "Exclude entry globs"
    Each entry is a partial *glob* and will be part of a resulting *glob* of the form `**/{glob1,glob2,...,globN}`. This means that all directories in the workspace matching an entry will be excluded, regardless of where in the workspace they reside.

## Viewing the Communication Between nREPL and Calva

It may be helpful to view the messages sent between nREPL and Calva when troubleshooting an issue related to the REPL. See how to do that [here](../nrepl_and_cider-nrepl/#viewing-the-communication-between-calva-and-nrepl).
