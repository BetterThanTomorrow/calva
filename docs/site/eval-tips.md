# Code Evaluation Tips

Calva tries to make it easy to evaluate code, supporting interactive development.

NB: _The below assumes you have read about [Finding Calva Commands and Shortcuts](finding-commands.md)._

## Evaluation in a File Editor

Calva has commands for evaluating the **current form** and the **current top-level form**.

You can also choose what should happen with the results:

1. **Inline.** This will display the results (or some of it, if it is long) inline in the editor. _You find the full results in the [output window](output.md)_, from where it is easy to copy it to the clipboard.
1. **To comments.** This will add the results as comment lines below the current line.
1. **Replace the evaluated code.** This will do what it says, the evaluated code will be replaced with its results.

## Wait, Current Form? Top-level Form?

These are important concepts in Calva in order for you to create your most effective workflow.

### Current Form

The current form either means the current selection, or otherwise is based on the cursor position. Play some with the command **Calva: Select current form**, `ctrl+alt+c s`, to figure out what Calva thinks is the current form for some different situations. Try it inside a symbol, adjacent to a symbol (both sides) and adjacent to an opening or closing bracket (again, both sides).

### Current Top-level Form

The current top-level form means top-level in a structural sense. It is _not_ the topmost form in the file. Typically in a Clojure file you will find `def` and `defn` (and `defwhatever`) forms at the top level, but it can be any form not enclosed in any other form.

An exception is the `comment` form. It will create a new top level context, so that any forms immediately inside a `(commment ...)` form will be considered top-level by Calva. This is to support a workflow where you

1. Iterate on your functions.
2. Evaluate the function (top level).
3. Put them to test with expressions inside a `comment` form.
4. Repeat from *1.*, until the function does what you want it to do.

Here's a demo of the last repetition of such a workflow, for a simple implementation of the `abs` function:

![top-level-eval](images/howto/top-level-eval.gif)

### Copying the inline results

There is a command called **Copy last evaluation results**, `ctrl+alt+c ctrl+c`.

This works regardless if you have evaluated in a file editor or in a REPL window.

## Evaluating in a REPL window

Since the REPL Window is mostly just a regular file, things work pretty similar at the REPL prompt. You use `alt+enter` to evaluate. Selecting the current form (default key binding `ctrl+w` after evaluating will select the result.
