# Something to Try First (After Connecting)

You might want to start with evaluating some code. This preferably starts with **Loading Current File and Dependencies**, `ctrl+alt+c enter`.

Then... Calva has this notion about the ”current” form. Issue the **Evaluate Current Form Inline** command, `ctrl+alt+c e` (`ctrl+alt+c v` on Windows) with the cursor placed in different locations to get a feeling for how the current form is determined. Dismiss the results display with `esc`.

There is also a command for evaluating the current top level form. Good for evaluating  various `def`s `defn`, `defthis`, `defthat`. With your cursor placed anywhere inside such a form, issue the **Evaluate Current Top Level Form (defun)** command (`ctrl+alt+c space`).

The Top Level command also works inside `(comment ...)` forms, treating the `comment` as creating a new top level context. It is good for in-file code experimentation.  To use it place the cursor inside a form contained inside a `(comment...)` and issue the command from there. It looks something like so:

![Comment top level form evaluation!](assets/howto/top-level-comment-eval.gif)

See also
* [Calva Top 10 Commands](commands-top10.md).
* [Code Evaluation Tips](eval-tips.md)
