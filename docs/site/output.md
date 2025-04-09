---
title: Evaluation results and other output
description: Calva displays the first line of the evaluation results inline, and also prints results, other REPL output and more to the configured Output Destination.
---

# Output Destinations

Calva categorizes output into three types:

* **evaluation results**: Clojure data returned from an evaluation.
* **evaluation output**: stdout/stderr from an evaluation
* **other output**: Other messages, logs, etc

With the setting `calva.outputDestinations`, you can configure where each category of output should go to:

* the [REPL Window](repl-window.md)
* the _Calva Says_ Output Channel
* the _Calva Output_ (pseudo) Terminal

The reason there are several options for this is partly legacy and partly because VS Code restricts the placement of different views in different ways. We hope you will find a combination of output destinations that suits you.

## Commands for showing output destinations

These are the commands and their default keyboard shortcuts for revealing output destinations

* **Calva: Show/Open the result output destination**, without focusing it - `ctrl+alt+o o`
* **Calva: Show/Open the Calva says Output Channel**, without focusing it - `ctrl+alt+o c`
* **Calva: Show/Open the Calva Output Terminal**, without focusing it - `ctrl+alt+o t`
* **Calva: Show/Open REPL Window**, also focuses it - `ctrl+alt+o r`

!!! Note "Focusing the output destination"
    The commands for opening the result destination all take a boolean argument for wether they should preserve focus or not. You can register keybindings that behave differently than the default ones. E.g.:

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

## See also

* [The Calva Results Inspector](inspector.md)
* [The REPL Window](repl-window.md)