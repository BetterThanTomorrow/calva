---
title: Custom REPL Connect Sequences
description: When Calva's built-in REPL project types do not suffice, you can reach for custom Jack-in and Connect sequences.
search:
  boost: 6
---

# REPL Jack-in and Connect Sequences

Many projects grow out of the template phase and call for custom developer workflows involving application start commands, customized REPLs, and what have you. Even some templates add this kind of complexity. To make Jack-in usable for a broader set of projects, Calva has a setting keyed `calva.replConnectSequences` which lets you configure one ore more connect sequences.

NB: _Connect sequence configuration affects Calva's Jack-in menu in the following ways:_

1. With _no sequence_ configured, Calva will prompt for the built-in sequences it has that seems to match your project.
1. When any number of connection sequences are configured, Calva will prompt for your custom sequences, as well as the built-in sequences. Whether built-in or custom, only sequences relevant to your project will be included in the prompt.

## Settings for adding Custom Sequences

A connect sequence configures the following:

* `name`: (required) This will show up in the Jack-in quick-pick menu when you start Jack-in (see above).
* `projectType`: (required) This is either "Leiningen”, ”deps.edn”, ”shadow-cljs”, ”lein-shadow”, "Gradle", or ”generic".
* `autoSelectForJackIn`: A boolean. If true, this sequence will be automatically selected at **Jack-in**, suppressing the Project Type. Use together with `projectRootPath` to also suppress the Project Root menu. Add usage of `menuSelections` to go for a prompt-less REPL Jack-in. If you have more than one sequence with `autoSelectForJackIn` set to true, the first one will be used.
* `autoSelectForConnect`: A boolean. If true, this sequence will be automatically selected at **Connect**, suppressing the Project Type menu. Use together with `projectRootPath` to also suppress the Project Root menu. If you have more than one sequence with `autoSelectForConnect` set to true, the first one will be used.
* `projectRootPath`: An array of path segments leading to the root of the project to which this connect sequence corresponds. Use together with `autoSelectForJackIn`/`autoSelectForConnect` to suppress the Project Root menu. The path can be absolute or relative to the workspace root. If there are several Workspace Folders, the workspace root is the path of the first folder, so relative paths will only work for this first folder.
* `nReplPortFile`: An array of path segments with the project root-relative path to the nREPL port file for this connect sequence. E.g. For shadow-cljs this would be `[".shadow-cljs", "nrepl.port"]`.
* `afterCLJReplJackInCode`: Here you can give Calva some Clojure code to evaluate in the CLJ REPL, once it has been created.
* `cljsType`: This can be either "Figwheel Main", "shadow-cljs", "ClojureScript built-in for browser", "ClojureScript built-in for node", "lein-figwheel", "none", or a dictionary configuring a custom type. If set to "none", Calva will skip connecting a ClojureScript repl. A custom type has the following fields:
    * `dependsOn`: (required) Calva will use this to determine which dependencies it will add when starting the project (Jacking in). This can be either "Figwheel Main", "shadow-cljs", "ClojureScript built-in for browser", "ClojureScript built-in for node", "lein-figwheel", or ”User provided”. If it is "User provided", then you need to provide the dependencies in the project or launch with an alias (deps.edn), profile (Leiningen), or build (shadow-cljs) that provides the dependencies needed.
    * `isStarted`: Boolean. For CLJS REPLs that Calva does not need to start, set this to true. (If you base your custom cljs repl on a shadow-cljs workflow, for instance.)
    * `startCode`: Clojure code to be evaluated to create and/or start your custom CLJS REPL.
    * `isReadyToStartRegExp`: A regular expression which, when matched in the stdout from the startCode evaluation, will make Calva continue with connecting the REPL, and to prompt the user to start the application. If omitted and there is startCode Calva will continue when that code is evaluated.
    * `openUrlRegExp`: A regular expression, matched against the stdout of cljsType evaluations, for extracting the URL with which the app can be started. The expression should have a capturing group named `url`. E.g. "Open URL: (?\<url\>S+)"
    * `shouldOpenUrl`: Choose if Calva should automatically open the URL for you or not.
    * `connectCode`: (required) Clojure code to be evaluated to convert the REPL to a CLJS REPL that Calva can use to connect to the application. (For some setups this could also conditionally start the CLJS REPL. If so: `startCode` should be omitted.)
    * `isConnectedRegExp`: (required) A regular expression which, when matched in the `stdout` from the `connectCode` evaluation, will tell Calva that the application is connected. The default is `To quit, type: :cljs/quit` and you should leave it at that unless you know it won't work.
    * `printThisLineRegExp`: regular expression which, when matched in the `stdout` from any code evaluations in the `cljsType`, will make the matched text be printed to the [Output window](output.md).
    * `buildsRequired`: Boolean. If the repl type requires that builds are started in order to connect to them, set this to true.
* `menuSelections`: a dictionary with pre-filled-in selections for the Jack-in and Connect prompts, making Calva not prompt for that particular selection:
    * `leinProfiles`: At Jack-in to a Leiningen project, use these profiles to launch the repl.
    * `leinAlias`: At Jack-in to a Leiningen project, launch with this alias. Set to `null` to launch with Calva's default task (a headless repl), w/o prompting.
    * `cljAliases`: At Jack-in to a deps.edn project, use these aliases to launch the repl.
    * `cljsLaunchBuilds`: The cljs builds to start/watch at Jack-in/connect.
    * `cljsDefaultBuild`: Which cljs build to attach to at the initial connect.
* `jackInEnv`: An object with environment variables that will be merged with the global `calva.jackInEnv` and then applied to the Jack-in process. The merge is very similar to how Clojure's `merge` works. So for any common keys between the global setting and this one, the ones from this setting will win.

The [Calva built-in sequences](https://github.com/BetterThanTomorrow/calva/blob/published/src/nrepl/connectSequence.ts) also use this format, check them out to get a clearer picture of how these settings work.

!!! Note "Force the project type menu to show"
    The convenience of `autoSelectForJackIn/Connect` can be an inconvenience when you want to use another project type/sequence for a project. For this reason, the `calva.connect` and `calva.jackIn` can be provided with an option `disableAutoSelect`, which forces the project root and project type menus to show. See [Options for the Connect Command](connect.md#options-for-the-jack-in-command) and [Options for the Jack-in Command](connect.md#options-for-the-connect-command) for more on this.

!!! Note "Path segments"
    `projectRootPath` and `nReplPortFile` both take an array of path segments. This is to make the paths work cross-platform. If you can't be bothered splitting up the path in segments, put the whole path in the first segment, though please note that if you use Windows path separators, these will not work for users with Linux or macOS.

## Example Sequences

Whether you just want to speed up your workflow or encode some workflow/mechanics into it, it's often the case that you can create a custom sequence that helps.

### Minimal menus with full stack shadow-cljs REPLs

Minimize the amount of selecting from the Jack-in/Connect menu when working with a full-stack shadow-cljs + deps/lein project:

``` json
    {
      "name": "backend + frontend",
      "projectType": "shadow-cljs",
      "cljsType": "shadow-cljs",
      "menuSelections": {
        "cljsLaunchBuilds": [
          ":app",
          ":test",
        ],
        "cljsDefaultBuild": ":app"
      }
    }
```

See [shadow-cljs + Clojure with Calva: The basics](https://blog.agical.se/en/posts/shadow-cljs-clojure-cljurescript-calva-nrepl-basics/) for how Calva and nREPL work with ClojureScript.


### Polylith

This is the connect sequences used in the [Polylith Real World App](https://github.com/furkan3ayraktar/clojure-polylith-realworld-example-app). The `(start)` sequence lets you jack-in to the project, and starts the Real World App without any prompts. The `(connect)` sequence can be used if you prefer to start the REPL manually, and want to connect without prompts.

```json
    "calva.replConnectSequences": [
        {
            "projectType": "deps.edn",
            "afterCLJReplJackInCode": "(require '[dev.server] :reload) (in-ns 'dev.server) (start! 6003)",
            "name": "Polylith RealWorld Server REPL (start)",
            "autoSelectForJackIn": true,
            "projectRootPath": ["."],
            "cljsType": "none",
            "menuSelections": {
                "cljAliases": ["dev", "test"]
            }
        },
        {
            "projectType": "deps.edn",
            "name": "Polylith RealWorld Server REPL (connect)",
            "autoSelectForConnect": true,
            "projectRootPath": ["."],
            "cljsType": "none",
        }
    ],
    "calva.autoConnectRepl": true,
```

The `calva.autoConnectRepl`, when set to `true`, makes Calva, at project open, look for the nRepl port file and automatically connect the repl if the file exists. Therefore, you can leave the app running when you close the project in VS Code, and Calva will reconnect when you open the project again. (Alternatively, maybe you just need to reload the VS Code window and not lose the REPL state.)

### Minimal menus with full stack deps.edn and Figwheel Main REPLs

Setting for a full-stack application. It starts the backend server when the CLJ REPL has started. Then proceeds to create a custom CLJS REPL (calling in to the application code for this). And then connects to it.

```json
{
    "calva.replConnectSequences": [
        {
            "name": "Example Sequence",
            "projectType": "Clojure-CLI",
            "afterCLJReplJackInCode": "(go)",
            "cljsType": {
                "startCode": "(do (require '[cljs-test.main :refer :all])(start-nrepl+fig))",
                "isReadyToStartRegExp": "Prompt will show",
                "connectCode": "(do (use 'cljs-test.main) (cljs-repl))",
                "isConnectedRegExp": "To quit, type: :cljs/quit",
                "printThisLineRegExp": "\\[Figwheel\\] Starting Server at.*"
            }
        }
    ]
}
```

### JUXT Edge

Here is an example from the [JUXT Edge](https://juxt.pro/blog/posts/edge.html) project template. It adds two sequences, one for when only the Clojure REPL should be launched and one for when the customized Edge cljs repl should also be connected. The **Edge backend + frontend** sequence specifies that the web app should be opened by Calva, making cljs repl connection more stable, and also adds `menuSelections` to skip the **launch aliases** prompt.

```json
{
    "calva.replConnectSequences": [
        {
            "name": "Edge backend only",
            "projectType": "deps.edn"
        },
        {
            "name": "Edge backend + frontend",
            "projectType": "deps.edn",
            "cljsType": {
                "dependsOn": "Figwheel Main",
                "startCode": "(do (require 'dev-extras) (dev-extras/go) (println \"Edge Figwheel Main started\") ((resolve 'dev-extras/cljs-repl)))",
                "isReadyToStartRegExp": "Edge Figwheel Main started",
                "openUrlRegExp": "Website listening on: (?<url>\\S+)",
                "printThisLineRegExp": "\\[Edge\\]",
                "shouldOpenUrl": true,
                "connectCode": "(do (require 'dev-extras) ((resolve 'dev-extras/cljs-repl)))",
                "isConnectedRegExp": "To quit, type: :cljs/quit",
                "buildsRequired": false
            },
            "menuSelections": {
                "cljAliases": [
                    "dev",
                    "build",
                    "dev/build"
                ],
            }
        }
    ]
}
```

### Plain deps.edn

A deps.edn sequence that does not promote the ClojureScript repl at all (leaving it a Clojure REPL), and leaves that up to you to do interactively. (Could be useful while you are developing a custom cljs repl.) The example is for when adapting a Figwheel Main repl.

```json
{
    "calva.replConnectSequences": [
        {
            "name": "Do not promote to cljs",
            "projectType": "deps.edn",
            "cljsType": {
                "dependsOn": "Figwheel Main",
                "connectCode": "\"Don't promote me bro!\"",
                "isConnectedRegExp": "Don't promote me bro!"
            }
        }
    ]
}
```
