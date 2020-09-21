# How to Use Calva With the re-frame Template

To make it easy to start the app created by the [re-frame template](https://github.com/day8/re-frame-template) use the `+calva` option when creating your project. In its plainest form that becomes:

```sh
$ lein new re-frame <app-name> +calva
```

If you have a re-frame project created from the template w/o the `+calva` option and want to get the ease, add this Connect Sequence in the `.vscode/settings.json` of the project:

```json
    "calva.replConnectSequences": [
        {
            "name": "Leiningen -> shadow-cljs",
            "projectType": "lein-shadow",
            "cljsType": "shadow-cljs",
            "menuSelections": {
                "leinAlias": null,
                "leinProfiles": [
                    "dev"
                ],
                "cljsLaunchBuilds": [
                    "app"
                ],
                "cljsDefaultBuild": "app"
            }
        }
    ],
```

Then **Jack-In**.