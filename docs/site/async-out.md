---
title: Viewing Async Output with Shadow-CLJS and Node
description: Tips on using Calva to create Node scripts using shadow-cljs
---

# Viewing Async Output While Working On Node Projects with `shadow-cljs`

When working on Node projects with `shadow-cljs` and Calva, async output does not always appear in the Calva output window. To work around this problem, follow these steps:

1. In a terminal run `npx shadow-cljs -d cider/cider-nrepl:0.27.4 node-repl`
2. Wait for the message `shadow-cljs - nREPL server started on port <some-port>`
3. Issue the command **Calva: Connect to a running REPL server in your project**, `ctrl+alt+c ctrl+alt+c`. For project type select `shadow-cljs`, accepted the proposed `localhost:<some-port>`, and for `build` select 'node-repl`.
4. Evaluating forms in Calva will show results in the output window. Synchronous `stdout` ouput will be printed in both the output window and in the terminal where you started the repl. Some asynchronous output may show up in the output window, but all will appear in the terminal.

If you use an integrated VSCode terminal to start shadow-cljs, all `stdut` will appear in the Calva window with your code. Alternatively, you can use an external terminal, which is especially nice when using a second monitor.


For discussion of this problem and other connection options, see issue #1468.
