# The Top 10 Calva Commands

There are not all that many Calva commands. You can learn them all if you like, but here are the most important ones to know about for effective Clojure/ClojureScript coding:

* **Grow/expand selection**: `ctrl+w`
* **Load current file**: `alt+ctrl+c enter`, evaluates the namespace code in the active editor tab. This also loads any required namespaces, and generally gives Calva what it needs to work.
* **Evaluate current form**:  `ctrl+enter` finds the form from the cursor position, evaluates it and displays the result inline. Hit `esc` to dismiss the results display.
* **Evaluate current top-level form**: `alt+enter`: inline evaluate the current top-level form. This also works inside `(comment)` forms. Use it to (re)define vars and then inside comment forms you can verify that they do what you want them to do.
* **Dismiss the display of results**: `escape`: (VIM Extension users should read [Using Calva with the VIM Extension](vim.md)).

There are also two commands for bringing over the current form and the current top level form over to the repl window:

* `ctrl+alt+c ctrl+alt+e` (`ctrl+alt+c ctrl+alt+v` on Windows): to paste the current form in the REPL window.
* `ctrl+alt+c ctrl+alt+space`: to paste the current top-level form in this window

You can also switch the name space of the output/repl window to that of the current file: `alt+ctrl+c alt+n`

* **Toggle pretty printing** of results on and off: `ctrl+alt+c p`. It's on by default. There is a status bar button showing the status and that also can be used to toggle the setting.


## Some More Commands to Try
- Code evaluation
    - Evaluate code and add as comment: `ctrl+alt+c c` (current form), `ctrl+alt+c ctrl+space` (current _top level_ form)
    - Evaluate code and replace it in the editor, inline: `ctrl+alt+c r`
- Integrated REPLs
    - Send current editor form to the REPL window: `ctrl+alt+c ctrl+alt+e` (`ctrl+alt+c ctrl+alt+v` on Windows)
    - Send current editor *top level* form to the REPL window: `ctrl+alt+c ctrl+alt+space`
- Run tests and mark failures and errors in the Problems pane
    - Run namespace tests: `ctrl+alt+c t`
    - Run all tests: `ctrl+alt+c shift+t`
    - Run current test: `ctrl+alt+c ctrl+alt+t`
    - Rerun previously failing tests: `ctrl+alt+c ctrl+t`
    - **Caveat**: Right now the tests are reported only when all are run, making it painful to run all tests in larger projects. I'll fix it. Promise!
- Select current form: `ctrl+alt+c s`.
- Run custom commands, i.e. code snippets, at will: `ctrl+alt+c .`

See also:

* [Code Evaluation Tips](eval-tips.md)
* [Finding Calva Commands and Shortcuts](finding-commands.md)
