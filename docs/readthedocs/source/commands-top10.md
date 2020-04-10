# The Top 10 Calva Commands

There are not all that many Calva commands, you can learn them all. But there are a few anyway and not all commands are created equal. Here are the most important ones to know about for effective Clojure/ClojureScript coding:

* **Grow/expand selection**: `ctrl+w`
* **Load current file**: `alt+ctrl+c enter`, evaluates the namespace code in the active editor tab. This also loads any required namespaces, and generally gives Calva what it needs to work.
* **Evaluate current form**:  `alt+ctrl+c e` (`alt+ctrl+c v` on Windows), finds the form from the cursor position, evaluates it and displays the result inline. Hit `esc` to dismiss the results display.
* **Evaluate current top-level form**: `alt+ctrl+c space`: inline evaluate the current top-level form. This also works inside `(comment)` forms. Use it to (re)define vars and then inside comment forms you can verify that they do what you want them to do.
* **Dismiss the display of results**: `escape`: (VIM Extension users should read [Using Calva with the VIM Extension](vim.md)).

The evaluation commands often have an equivalent for when you want to use the REPL window for further exploration. (Basically you add the `ctrl+alt` modifier to the second chord in the shortcuts):

* `alt+ctrl+c ctrl+alt+e`: to evaluate the current form in the REPL window.
* `alt+ctrl+c ctrl+alt+space`: to evaluate the current top-level form in this window
* **Load current namespace in the REPL window** `alt+ctrl+c ctrl+alt+n`

* **Toggle pretty printing** of results on and off: `ctrl+alt+c p`. It's on by default. There is a status bar button showing the status and that also can be used to toggle the setting.


## Some More Commands to Try
- Code evaluation
    - Evaluate code and add as comment: `ctrl+alt+c c` (current form), `ctrl+alt+c ctrl space` (current _top level_ form)
    - Evaluate code and replace it in the editor, inline: `ctrl+alt+c r`
- Integrated REPLs
    - Load current namespace in the REPL window: `ctrl+alt+c ctrl+alt+n`
    - Evaluate current editor form in the REPL window: `ctrl+alt+c ctrl+alt+e` (`ctrl+alt+c ctrl+alt+v` on Windows)
    - Evaluate current editor top level form in the REPL window: `ctrl+alt+c ctrl+space`
- Running tests and mark failures and errors in the Problems pane
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
