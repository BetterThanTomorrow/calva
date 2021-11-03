---
title: Krell
description: Learn how to configure a Calva REPL COnnect sequence for your Krell project, à la carte ClojureScript tooling for React Native
---

# Using Calva With Krell

[Krell](https://github.com/vouch-opensource/krell) is à la carte ClojureScript tooling for React Native.

Even if Calva does not yet have built-in support, all is not lost. You can add support yourself by way of a [Custom REPL Connect Sequence](connect-sequences.md). Here's how;

## Starting the Krell ClojureScript REPL

Add this *REPL Connect Sequence* to your workspace `settings.json`:

```json
    "calva.replConnectSequences": [
        {
            "name": "deps.edn + Krell",
            "projectType": "deps.edn",
            "cljsType": {
                "connectCode": "(require '[clojure.edn :as edn] \n    '[clojure.java.io :as io]\n    '[cider.piggieback] \n    '[krell.api :as krell]\n    '[krell.repl])\n\n(def config (edn/read-string (slurp (io/file \"build.edn\"))))\n(apply cider.piggieback/cljs-repl (krell.repl/repl-env) (mapcat identity config))",
                "dependsOn": "User provided"
            }
        }
    ]
```

Then issue the command **Start a Project REPL and Connect (aka Jack-In)**. It start the project and connect to the Krell REPL once the app is running on a device (wether real or virtual/emulated).

## Additional VS Code Tips

For a smooth workflow you can also:

* Install the [React Native Tools](https://github.com/Microsoft/vscode-react-native) extension
* Install the [Debugger for Chrome](https://github.com/Microsoft/vscode-chrome-debug) extension, and add this *Launch Configuration*
    ```json
            {
                "type": "chrome",
                "request": "launch",
                "name": "Launch Debugger",
                "url": "http://localhost:8081/debugger-ui/",
                "webRoot": "${workspaceFolder}"
            }
    ```

Together with the connect sequence this will make for a start of a Krell session like this:

1. Open the project root in VS Code
1. Issue the **Jack-in** command
1. Issue the **React Native; Run Android on Emulator** (or **Run iOS on Simulator**) command. (Disable *Fast Refresh* from the *React Native dev menu, if it is enabled.)
1. Issue the **React Native: Run Element Inspector** command
    (You might need to install the React Native inspector globally):
    ```sh
    yarn global add react-devtools
    ````
1. **Launch Debugger** (`F5`)
1. Hack away, with hot reload and interactive REPL

Once the debugger (a Chrome session) is running, you probably will want to enable *Custom Formatters* in order for clojure structures to be logged conveniently.