---
title: Viewing Async Output with Shadow-CLJS and Node
description: Tips on using Calva to create Node scripts using shadow-cljs
---

# Viewing Async Output While Working On Node Projects with `shadow-cljs`

When working on NodeJS projects with `shadow-cljs` and Calva, async output does not always appear in the Calva [output destination](output.md). To work around this problem, follow these steps:

1. Run the command "Calva: Copy Jack-in Command Line to Clipboard", then paste the command in a terminal and run it.
2. Wait for the message `shadow-cljs - nREPL server started on port <some-port>`
3. Issue the command **Calva: Connect to a running REPL server in your project**, `ctrl+alt+c ctrl+alt+c`. For project type select `shadow-cljs`, accept the proposed `localhost:<some-port>`, and for `build` select `node-repl`.
4. Load a file from your project with the command `ctrl+alt+c Enter.` Evaluating forms in Calva will show results in the output destination. Synchronous `stdout` output will be printed in both the output destination and in the terminal where you started the repl. Some asynchronous output may show up in the output destination, but all will appear in the terminal.

If you use an integrated VSCode terminal to start shadow-cljs, all `stdout` will appear in the VS Code window with your code. Alternatively, you can use an external terminal, which is especially nice when using a second monitor.

For a discussion of this problem and other connection options, see [issue #1468](https://github.com/BetterThanTomorrow/calva/issues/1468).
