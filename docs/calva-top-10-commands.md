## The Top 10 Calva Commands

There are not all that many Calva commands, you can quite easily learn them all. But not all commands are created equal. Here are the most important ones to know about for effective Clojure/ClojureScript coding:

* **Load current file**: `alt+ctrl+c enter`, evaluates the namespace code in the active editor tab. This also loads any required namespaces, and generally gives Calva what it needs to work.
* **Evaluate current form**:  `alt+ctrl+c e`, finds the form from the cursor position, evaluates it and displays the result inline. Hit `esc` to dismiss the results display.
* **Evaluate current top-level form**: `alt+ctrl+c space`: inline evaluate the current top-level form. This also works inside `(comment)` forms. Use it to (re)define vars and then inside comment forms you can verify that they do what you want them to do.

The evaluation commands often have an equivalent for when you want to use the REPL window for further exploration. (Basically you add the `alt` modifier to the second chord in the shortcuts):
* `alt+ctrl+c alt+e`: to evaluate the current form in the REPL window.
* `alt+ctrl+c alt+space`: to evaluate the current top-level form in this window
* **Switch REPL window namespace** `alt+ctrl+c alt+n`: to make the REPL window's current namespace the same as the editor's. Note that when evaluating forms from an editor, the REPL window will always use the editor's namespace to evaluate it, so sometimes this ”sticky” switching isn't necessary.

See the [Calva wiki](https://github.com/BetterThanTomorrow/calva/wiki) for further tips.

Happy coding! ❤️