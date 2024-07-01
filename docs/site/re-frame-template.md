---
title: The re-frame template
description: How to use Calva with the re-frame template
---

# How to use Calva with the re-frame template

The [re-frame template](https://github.com/day8/re-frame-template) creates a `shadow-cljs` project, making it easy to use with Calva.

1. `npm install`
2. From VS Code, issue the command **Calva: Start a Project REPL and Connect (a.k.a Jack-in)**, `ctrl+alt+c ctrl+alt+j`.
   * Calva will auto-detect that this is a `shadow-cljs` project and ask for which build to compile.
   * Calva's output destination will open and log some progress information.
3. When prompted for which build to start, select `:app`.
   * `:app` is the only configured build, but the VS Code menu for this is a bit strange so _make sure the `:app` checkbox is really ticked before proceeding_.
   * This will start the app, so in this workflow you don't do the **Run application** steps outlined below.
4. When prompted for which build to connect to, select `:app`.
    * In the **View** menu of VS Code, you can tell it to show the **Terminal** view, where you see which command the jack-in process is started with, and it's output. `Ctrl+C` in this pane will kill your app and free up all resources it has allocated.
5. When the app is compiled
    1. Open http://localhost:8280 in your browser.
    2. Confirm that it says *Hello from re-frame*. (Depending on how long the app takes to compile, you might need to reload the page a few times.)
6. Open the `views.cljs` file from `src/<your-project-name>` and issue **Calva: Load/Evaluate Current File and its Requires/Dependencies**. `ctrl+alt+c enter`.
    1. Confirm that you are connected by adding evaluating `(js/alert "Hello from Calva")` (`alt+enter` and `ctrl+enter` are your friends).
    2. Confirm that Shadow is hot reloading by changing the greeting message.
