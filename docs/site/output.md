---
title: Output Overview
description: Calva displays the first line of the evaluation results inline, and also prints results, other REPL output and more to the configured Output Destination.
---

## Output Destinations

Calva categorizes output into three types.

| Category |   |
| ---------- | --- |
| `evalResults` | Clojure data returned from an evaluation |
| `evalOutput` | `stdout` and `stderr` produced by an evaluation |
| `otherOutput` | Other REPL output, such as Calva messages and redirected server output |

Each category can be relayed to one of four **Output Destinations**:

| Destination |     |
| ------------| --- |
| `"terminal"` | The _Calva Output_ (pseudo) Terminal. This is the default destination. |
| `"output-view"` | The [output view](output-view.md) (a read-only view that is much more performant than the REPL  |Window).
| `"repl-window"` | The [REPL Window](repl-window.md) (an editor-based read/write output view). |
| `"output-channel"` | The _Calva Says_ Output Channel. |

The `calva.outputDestinations` setting is an object which maps from a given output category to an output destinations.

The default configuration is to relay all categories to the Calva output terminal:

```json
"calva.outputDestinations": {
  "evalResults": "terminal",
  "evalOutput": "terminal",
  "otherOutput": "terminal"
}
```

### Output Destinations Feature Comparison

The table below lists the features of the different output destinations.

| Feature | REPL Window | Output View | Output Channel | Terminal |
| :------ | :---------: | :---------: | :------------: | :------: |
| Can be placed in VS Code Panel views (sidebars and bottom panel) | ❌ | ❌ | ✅ | ✅ |
| Can be placed in VS Code Editors area | ✅ | ✅ | ❌ | ✅ |
| Rich stack traces | ✅ | ❌ * | ❌ | ❌ |
| Paredit navigation and selection | ✅ | ❌ * | ❌ | ❌ |
| Button to copy specific output | ❌ | ✅ | ❌ | ❌ |
| Syntax highlighting | ✅ | ✅ | ✅ | ✅ |
| Syntax highlighting matches editor | ✅ | ❌ * | ❌ | ❌ |
| Supports input | ✅ | ❌ | ❌ | ❌ * |
| TUI applications (progress bars, cursor positioning) | ❌ | ❌ | ❌ | ✅ |
| Handles high volume output well | ❌ | ✅ | ✅ | ✅ |
| Handles large data structures well | ❌ | ✅ | ✅ | ✅ |
| Command for clearing output | ❌ | ✅ | ✅ | ✅ |

\* Support can be added.

## Commands for revealing output destinations

These are the commands and their default keyboard shortcuts for revealing output destinations

* **Calva: Show/Open the result output destination**, without focusing it - `ctrl+alt+o o`
* **Calva: Show/Open the Calva says Output Channel**, without focusing it - `ctrl+alt+o c`
* **Calva: Show/Open the Calva Output Terminal**, without focusing it - `ctrl+alt+o t`
* **Calva: Show/Open REPL Window**, also focuses it - `ctrl+alt+o r`
* **Calva: Show/Open the REPL output view**, without focusing it - `ctrl+alt+o w`

!!! Note "Focusing the output destination"
    The commands for opening the result destination all take a boolean argument for whether they should preserve focus or not. You can register keybindings that behave differently than the default ones. E.g.:
    ```json
    {
      "key": "ctrl+alt+o ctrl+alt+o",
      "command": "calva.showResultOutputDestination",
      "args": false
    },
    {
      "key": "ctrl+alt+o ctrl+alt+r",
      "command": "calva.showReplWindow", // Show/Open REPL Window
      "args": true
    },
    ```

## About stdout in the REPL Window

Since Calva v2.0.423 the REPL Window prints `stdout` prepended with `;` to make it into line comments. This is because stdout output easily breaks the Clojure structure of the REPL Window, making it misbehave in various ways. We made this change because as maintainers of Calva we have seen all too often how this hits users, and it is also taking too much of our Calva time to try mitigate the problem, which is fundamentally not fixable.

There are now other output destinations that do not have this limitation.

All that said. If you want to keep using the REPL Window for stdout output, and need the old behavior, you can enable the setting: `calva.legacyPrintBareReplWindowOutput`. Please note that at some point after we have created a dedicated Output Window, the REPL Window will probably be retired as a destination for output.

## REPL process output (stdout and stderr)

When Calva is connected to the REPL, the Output destination will by default print not only results of evaluations, but also:

1. Things printed to `stdout` and `stderr` in the **main thread** of the evaluations
2. Things printed to `stdout` and `stderr` from **child threads** of the evaluations
3. Anything printed to `stdout` and `stderr` by the REPL process

You can control the default via the `calva.redirectServerOutputToRepl` setting. It defaults to `true`. Setting it to `false` before connecting the REPL will result in that **2.** and **3.** will not get printed in the Output destination. It will then instead be printed wherever the REPL process is printing its messages, usually the terminal from where it was started (the **Jack-in terminal** if Calva started the REPL).

Examples:

```clojure
;; With redirectServerOutputToRepl set to true, these will print in the REPL output destination
;; With redirectServerOutputToRepl set to false, these will print wherever the REPL process is printing its messages
(.start (Thread. (fn [] (/ 1 0))))
(.start (Thread. (fn [] (println "hello world"))))
```

## See also

* [The Calva Results Inspector](inspector.md)
* [The REPL Window](repl-window.md)
* [The Output View](output-view.md)
