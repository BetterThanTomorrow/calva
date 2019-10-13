# The Top 10 Calva Commands
(Not to be confused with The Ten Commandments.)

![Calva logo](https://raw.githubusercontent.com/BetterThanTomorrow/calva/master/assets/calva-64h.png)

There are not all that many Calva commands, you can learn them all. But there are a few anyway and not all commands are created equal. Here are the most important ones to know about for effective Clojure/ClojureScript coding:

* **Load current file**: `alt+ctrl+c enter`, evaluates the namespace code in the active editor tab. This also loads any required namespaces, and generally gives Calva what it needs to work.
* **Evaluate current form**:  `alt+ctrl+c e`, finds the form from the cursor position, evaluates it and displays the result inline. Hit `esc` to dismiss the results display.
* **Evaluate current top-level form**: `alt+ctrl+c space`: inline evaluate the current top-level form. This also works inside `(comment)` forms. Use it to (re)define vars and then inside comment forms you can verify that they do what you want them to do.

The evaluation commands often have an equivalent for when you want to use the REPL window for further exploration. (Basically you add the `ctrl+alt` modifier to the second chord in the shortcuts):
* `alt+ctrl+c ctrl+alt+e`: to evaluate the current form in the REPL window.
* `alt+ctrl+c ctrl+alt+space`: to evaluate the current top-level form in this window
* **Switch REPL window namespace** `alt+ctrl+c ctrl+alt+n`: to make the REPL window's current namespace the same as the editor's. Note that when evaluating forms from an editor, the REPL window will always use the editor's namespace to evaluate it, so sometimes this ”sticky” switching isn't necessary.

See also:

* [[Code Evaluation Tips]]
* [[Finding Calva Commands and Shortcuts]]

Happy coding! ❤️