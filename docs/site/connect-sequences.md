# REPL Jack-in and Connection Sequences

Many projects grow out of the template phase and call for custom developer workflows involving application start commands, customized REPLs, and what have you. Even some templates add this kind of complexity. To make Jack-in usable for a broader set of projects, Calva has a setting keyed `calva.replConnectSequences` which lets you configure one ore more connect sequences.

NB: _Connect sequence configuration affects Calva's Jack-in menu in the following ways:_

1. With _no sequence_ configured, Calva will prompt for the built-in sequences it has that seems to match your project.
1. When any number of connection sequences are configured, Calva will prompt for your custom sequences, as well as the built-in sequences. Whether built-in or custom, only sequences relevant to your project will be included in the prompt.

## Settings for adding Custom Sequences

A connect sequence configures the following:

* `name`: (required) This will show up in the Jack-in quick-pick menu when you start Jack-in (see above).
* `projectType`: (required) This is either "Leiningen”, ”Clojure CLI”, ”shadow-cljs”, ”lein-shadow”, or ”generic".
* `nReplPortFile`: An array of path segments with the project root-relative path to the nREPL port file for this connect sequence. E.g. For shadow-cljs this would be `[".shadow-cljs", "nrepl.port"]`.
* `afterCLJReplJackInCode`: Here you can give Calva some Clojure code to evaluate in the CLJ REPL, once it has been created.
* `cljsType`: This can be either "Figwheel Main", "lein-figwheel", "shadow-cljs", "Nashorn", "none", or a dictionary configuring a custom type. If set to "none", Calva will skip connecting a ClojureScript repl. A custom type has the following fields:
    * `dependsOn`: (required) Calva will use this to determine which dependencies it will add when starting the project (Jacking in). This can be either "Figwheel Main", "lein-figwheel", "shadow-cljs", "Nashorn", or ”User provided”. If it is "User provided", then you need to provide the dependencies in the project or launch with an alias (deps.edn), profile (Leiningen), or build (shadow-cljs) that provides the dependencies needed.
    * `isStarted`: Boolean. For CLJS REPLs that Calva does not need to start, set this to true. (If you base your custom cljs repl on a shadow-cljs workflow, for instance.)
    * `startCode`: Clojure code to be evaluated to create and/or start your custom CLJS REPL.
    * `isStartedRegExp`: A regular expression which, when matched in the stdout from the startCode evaluation, will make Calva continue with connecting the REPL, and to prompt the user to start the application. If omitted and there is startCode Calva will continue when that code is evaluated.
    * `openUrlRegExp`: A regular expression, matched against the stdout of cljsType evaluations, for extracting the URL with which the app can be started. The expression should have a capturing group named `url`. E.g. "Open URL: (?\<url\>S+)"
    * `shouldOpenUrl`: Choose if Calva should automatically open the URL for you or not.
    * `connectCode`: (required) Clojure code to be evaluated to convert the REPL to a CLJS REPL that Calva can use to connect to the application. (For some setups this could also conditionally start the CLJS REPL. If so: `startCode` should be omitted.)
    * `isConnectedRegExp`: (required) A regular expression which, when matched in the `stdout` from the `connectCode` evaluation, will tell Calva that the application is connected. The default is `To quit, type: :cljs/quit` and you should leave it at that unless you know it won't work.
    * `printThisLineRegExp`: regular expression which, when matched in the `stdout` from any code evaluations in the `cljsType`, will make the matched text be printed to the [Output window](output.md).
    * `buildsRequired`: Boolean. If the repl type requires that builds are started in order to connect to them, set this to true.
* `menuSelections`: a dictionary with pre-filled-in selections for the Jack-in and Connect prompts, making Calva not prompt for that particular selection:
    * `leinProfiles`: At Jack-in to a Leiningen project, use these profiles to launch the repl.
    * `leinAlias`: At Jack-in to a Leiningen project, launch with this alias. Set to `null` to launch with Calva's default task (a headless repl), w/o prompting.
    * `cljAliases`: At Jack-in to a Clojure CLI project, use these aliases to launch the repl.
    * `cljsLaunchBuilds`: The cljs builds to start/watch at Jack-in/connect.
    * `cljsDefaultBuild`: Which cljs build to attach to at the initial connect.

The [Calva built-in sequences](https://github.com/BetterThanTomorrow/calva/blob/master/src/nrepl/connectSequence.ts) also use this format, check them out to get a clearer picture of how these settings work.

## Example Sequences

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
                "isStartedRegExp": "Prompt will show",
                "connectCode": "(do (use 'cljs-test.main) (cljs-repl))",
                "isConnectedRegExp": "To quit, type: :cljs/quit",
                "printThisLineRegExp": "\\[Figwheel\\] Starting Server at.*"
            }
        }
    ]
}
```

Here is an example from the [JUXT Edge](https://juxt.pro/blog/posts/edge.html) project template. It adds two sequences, one for when only the Clojure REPL should be launched and one for when the customized Edge cljs repl should also be connected. The **Edge backend + frontend** sequence specifies that the web app should be opened by Calva, making cljs repl connection more stable, and also adds `menuSelections` to skip the **launch aliases** prompt.

```json
{
    "calva.replConnectSequences": [
        {
            "name": "Edge backend only",
            "projectType": "Clojure CLI"
        },
        {
            "name": "Edge backend + frontend",
            "projectType": "Clojure CLI",
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

A Clojure CLI sequence that does not promote the ClojureScript repl at all (leaving it a Clojure REPL), and leaves that up to you to do interactively. (Could be useful while you are developing a custom cljs repl.) The example is for when adapting a Figwheel Main repl.

```json
{
    "calva.replConnectSequences": [
        {
            "name": "Do not promote to cljs",
            "projectType": "Clojure CLI",
            "cljsType": {
                "dependsOn": "Figwheel Main",
                "connectCode": "\"Don't promote me bro!\"",
                "isConnectedRegExp": "Don't promote me bro!"
            }
        }
    ]
}
```
