# How to Use Calva with Luminus

[Luminus](https://luminusweb.com) is a powerful and versitle Leiningen template for creating web development projects. It comes with built in configuration for making it easy to use Calva as your Clojure(Script) editor. Here are the steps involved.

## Server Only

The workflow here is really just: Jack-in and start hacking. The first time it involves these steps, however:

0. If you haven't created the project yet, create a new server only Luminus project. For a all-defaults setup it is like so:
    ```sh
    $ lein new luminus my-luminus-server
    ```
0. This creates the folder `my-luminus-server`. Open it in VS Code:
    ```sh
    $ code my-luminus-server
    ```
0. Use the Calva command **Start a Project REPL and Connect (aka Jack-in)**: `ctrl+alt+c ctrl+alt+j` and wait for the **Calva says** output to say `Jack-in done.`
0. Open http://0.0.0.0:3000 in your web browser and start hacking.


## Server and shadow-cljs

For shadow-cljs Luminus projects, the workflow is: Jack-in to the server, then Jack-in to the client, then start hacking. The first time it involves these steps:

0. If you haven't created the project yet, create a new shadow-cljs Luminus project. E.g.:
    ```sh
    $ lein new luminus my-luminus-shadow +reagent +shadow-cljs
    ```

This creates the folder `my-luminus-shadow`, which will contain two VS Code Workspaces – one for the server, and one for the client.


### Server Workspace

1. Open the project folder:
   ```sh
   $ code my-luminus-shadow
   ```
1. VS Code should offer you a button to select a workspace, click it and select **Server-my-luminus-shadow**. (Otherwise do **File -> Open Workspace...**)
1. Use the Calva command **Start a Project REPL and Connect (aka Jack-in)**: `ctrl+alt+c ctrl+alt+j` and wait for the **Calva says** _Output channel_ to say `Jack-in done.`
1. Continue to the Client

### Client Workspace

1. Open the project folder:
   ```sh
   $ code my-luminus-shadow
   ```
1. VS Code should offer you a button to select a workspace, click it and select **Client-my-luminus-shadow**.
1. Use the Calva command **Start a Project REPL and Connect (aka Jack-in)**: `ctrl+alt+c ctrl+alt+j` and wait for the _Terminal_ **Calva Jack-in** output to say `[:app] Build completed.`
1. Open http://0.0.0.0:3000 in your web browser and start hacking.


## Server and Figwheel

As with the server only, the workflow here is really just: Jack-in and start hacking. The first time it involves these steps:

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

If you rather open the web app yourself, open `.vscode/settings.json` and change `"shouldOpenUrl"` to `false` in the preconfigured Calva connect sequence.

## Etcetera

You will have three Calva _Custom Command Snippets_ configured. Invoke them by issuing the **Run Custom REPL Command**, `ctrl+alt+c .` (that's a dot). The commands control the Luminus server:

1. `Start <project> Server`
2. `Stop <project> Server`
3. `Restart <project> Server`

When used, Calva will open its REPL window and excute the command, if it is not already opened. You can close this window if you prefer to use the REPL directly from the Clojure files.

Calva also opens the REPL window, and starts the Luminus server, as part of the Jack-in process.
