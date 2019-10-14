# Code Evaluation Tips

Calva tries to make it easy to evaluate code, supporting interactive development.

NB: _The below assumes you have read about [Finding Calva Commands and Shortcuts](finding-commands.md)._

There are some different ”flavors” to the evaluation. And it depends on if you are evaluating in a file editor or a in a REPL window.

## Evaluation in a File Editor

Calva has commands for evaluating the **current form** and the **current top-level form**.

You can also choose what should happen with the results:

1. **Inline.** This will display the results (or some of it, if it is long) inline in the editor. _You find the full results in the hover of the eveluated form_, from where it is easy to copy it to the clipboard. (The results will also get printed to the **Calva says** output channel.)
1. **To comments.** This will add the results as comment lines below the current line.
1. **Replace the evaluated code.** This will do what it says, the evaluated code will be replaced with its results.
1. **Send to REPL window.** You can also send the current form, or current top-level form, to the REPL window for evaluation. This is currently the only way to get a readable and clickable stack trace in cases where evaluation results in such errors.

## Wait, Current Form? Top-level Form?

These are important concepts in Calva in order for you to create your most effective workflow.

### Current Form

The current form either means the current selection, or otherwise is based on the cursor position. Play some with the command **Calva: Select current form**, `ctrl+alt+c s`, to figure out what Calva thinks is the current form for some different situations. Try it inside a symbol, adjacent to a symbol (both sides) and adjacent to an opening or closing bracket (again, both sides).

### Current Top-level Form

The current top-level form means top-level in a structural sense. It is _not_ the topmost form in the file. Typically in a Clojure file you will find `def` and `defn` (and `defwhatever`) forms at the top level, but it can be any form not enclosed in any other form.

An exception is the `comment` form. It will create a new top level context, so that any forms immediatlly inside a `(commment ...)` form will be considered top-level by Calva. This is to support a workflow where you

1. Iterate on your functions.
2. Evaluate the function (top level).
3. Put them to test with expressions inside a `comment` form.
4. Repeat from *1.*, until the function does what you want it to do.

Here's a demo of the last repetition of such a workflow, for a simple implementation of the `abs` function:

![top-level-eval](https://user-images.githubusercontent.com/30010/59426414-6ea0e000-8dd8-11e9-9db3-ae4ede2e0463.gif)

### Copying the inline results

The easiest way is to use the **Copy** button in the result hover. There is also the **Copy last evaluation results** command, `ctrl+alt+c ctrl+c`.

This works regardless if you have evaluated in a file editor or in a REPL window.

## Evaluating in a REPL window

To evaluate code in the REPL window either send a form from the editor (as mentioned above) or type it at the prompt and submit it. There is also a repl history that you can access with `alt+up/down`.

Note that the repl prompt is a _multiline_ mini Clojure editor. So if you press `enter` while the cursor is not at the end of the line, it will create a new line. To submit the code at the prompt you have three options:

1. Place the cursor at the end of the all the code, `end` (`fn+right` on Macs lacking an `end` key).
2. Press `alt+enter`. This submits and prints the results un-altered.

See also above about sending forms from the file editors to the REPL window for evaluation.
