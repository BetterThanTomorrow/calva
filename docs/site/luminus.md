# How to Use Calva with Luminus

[Luminus](https://luminusweb.com) is a powerful and versatile Leiningen template for creating web development projects. It comes with built in configuration which makes it easy to use Calva as your Clojure(Script) editor.

<iframe width="560" height="315" src="https://www.youtube.com/embed/0zaGtbc-5oc" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

---

## Server + shadow-cljs

Basically this is the same wokflow as with **Server only**. Behind the scenes there is more happening, though. Such as the ClojureScript app being built and the CLJS REPL connected once the web app is running.

0. If you haven't created the project yet, create a new shadow-cljs Luminus project. E.g.:
    ```sh
    $ lein new luminus my-luminus-shadow +reagent +shadow-cljs
    ```
0. This creates the folder `my-luminus-shadow`. Open it in VS Code:
    ```sh
    $ code my-luminus-shadow
    ```
0. Use the Calva command **Start a Project REPL and Connect (aka Jack-in)**: `ctrl+alt+c ctrl+alt+j`
   * Select to start **Server + Client – my-luminus-shadow**, and wait for the _Terminal_ **Calva Jack-in** output to say `[:app] Build completed.`
0. Open [127.0.0.1:3000](http://127.0.0.1:3000) in your web browser and start hacking.

!!! Note
    Currently Calva has troubles following the app-start with shadow-cljs, so Calva will report `Jack-in done.` in the output window before shadow-cljs is actually done building the app. If you open the app page at that stage, you will see a message to “Please run `lein shadow watch app`”. Rest assured that _this is already underway._ Follow the Jack-in process in the _Terminal_ tab in VS Code for the message that the app is built, _then_ reload the app page in the web browser.

## Server Only

The workflow here is really just: Jack-in and start hacking. However, the first time it will involve these steps:

0. If you haven't created the project yet, create a new server only Luminus project. For a all-defaults setup it is like so:
    ```sh
    $ lein new luminus my-luminus-server
    ```
0. This creates the folder `my-luminus-server`. Open it in VS Code:
    ```sh
    $ code my-luminus-server
    ```
0. Use the Calva command **Start a Project REPL and Connect (aka Jack-in)**: `ctrl+alt+c ctrl+alt+j` and wait until you see `Jack-in done.` in the output window.
0. Open [127.0.0.1:3000](http://127.0.0.1:3000) in your web browser and start hacking.

## Server + Figwheel

_This is Legacy Figwheel (lein-figwheel), so the recommendation is to use the shadow-cljs setup instead._ As with the server only, the workflow here is really just: Jack-in and start hacking. The first time it involves these steps:

0. If you haven't created the project yet, create a new server only Luminus project. E.g.:
    ```sh
    $ lein new luminus my-fw +reagent
    ```
0. This creates the folder `my-fw`. Open it in VS Code:
    ```sh
    $ code my-fw
    ```
0. Use the Calva command **Start a Project REPL and Connect (aka Jack-in)**: `ctrl+alt+c ctrl+alt+j`, select **Server + Client - my-fw** in the _Project type_ picker menu, and wait for the web app to pop open in your web browser.
0. Start hacking.

If you prefer to open the web app yourself, open `.vscode/settings.json` and change `"shouldOpenUrl"` to `false` in the pre-configured Calva connect sequence. Calva will then print the URL [127.0.0.1:3000](http://127.0.0.1:3000) in the output, so that you can click it open.

## Etcetera

You will have three Calva _Custom Command Snippets_ configured. Invoke them by issuing the **Run Custom REPL Command**, `ctrl+alt+c .` (that's a dot). These commands control the Luminus server:

1. `Start <project> Server`
2. `Stop <project> Server`
3. `Restart <project> Server`

When used, Calva will open its REPL window and execute the command, if it is not already opened. You can close this window if you prefer to use the REPL directly from the Clojure files.

Calva also opens the REPL window, and starts the Luminus server, as part of the Jack-in process.
