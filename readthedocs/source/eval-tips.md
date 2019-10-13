# Code Evaluation Tips

Calva tries to make it easy to evaluate code, supporting interactive development.

NB: _The below assumes you have read about [Finding Calva Commands and Shortcuts](finding-commands.html)._

There are some different ” flavors” to the evaluation. And it depends if you are evaluating in a file editor or a in a REPL window.

## Evaluation in a File Editor

Calva has commands for evaluating the **current form** and the **current top-level form**. (See below for more on ”current” forms).

You can also choose what should happen with the results:

1. Inline. This will display the results (or some of it, if it is long) inline in the editor. _It will also print the results in the **Calva says** output channel._
1. Pretty printed. The output is sent to the **Calva says** output channel, pretty printed.
1. To comments. This will pretty print the results as comment lines below the current line.
1. Replace the evaluated code. This will do what it says, the evaluated code will be replaced with its results. Useful for transforming literal data structures, but has limitations in some situations, e.g. when you have functions as part of the data structure.

## Wait, Current Form? Top-level Form?

These are important concepts in Calva in order for you to create your most effective workflow.

### Current Form

The current form either means the current selection, or otherwise is based on the cursor position. Play some with the command **Calva: Select current form**, `ctrl+alt+c s`, to figure out what Calva thinks is the current form for some different situations. Try it inside a symbol, adjacent to a symbol (both sides) and adjacent to an opening or closing bracket (again, both sides).

### Current Top-level Form

The current top-level form means top-level in a structural sense. It is _not_ the topmost form in the file. Typically in a Clojure file you will find `def` and `defn` (and `defwhatever`) forms at the top level, but it can be any form not enclosed in any other form (enclosed by the file, if you like).

An exception is the `comment` form. It will create a new top level, so that any forms immediatlly inside them will be considered top-level by Calva. This is to support a workflow where you

1. Iterate on your functions.
2. Evaluate them (they are top level, remember?).
3. Put them to test with expressions inside a `comment` form.
4. Repeat from *1.*, until the function does what you want it to do.

Here's a demo of the last repetition of such a workflow, for a simple implementation of the `abs` function:

![top-level-eval](https://user-images.githubusercontent.com/30010/59426414-6ea0e000-8dd8-11e9-9db3-ae4ede2e0463.gif)

## Send to REPL window

You can also evaluate the current form, or current top-level form, to the REPL window for evaluation. This is currently the only way to get a readable and clickable stack trace in cases where evaluation results in such errors.

## Copying the inline results
This was asked in [issue #219](https://github.com/BetterThanTomorrow/calva/issues/219):

> Given this inline evaluation:
> 
> ![](https://user-images.githubusercontent.com/873610/59314717-29679b80-8c7c-11e9-9ae1-04efc796cb51.png)
> 
> How do I capture the text as the result? If I execute this again and send it to the repl, it'll be a different value. I want to get it on my clipboard.

Answer:
1. Copy it from the **Calva says** output pane. Everything that you evaluate inline also gets printed there.
2. Use the **Copy last evaluation results** command, `ctrl+alt+c ctrl+c`.

# Evaluating in a REPL window

To evaluate code in the REPL window type it at the prompt and submit it. (There is also a repl history that you can access with `alt+up/down`.)

Note that the repl prompt is a _multiline_ mini Clojure editor. So if you press `enter` while the cursor is not at the end of the line, it will create a new line. To submit the code at the prompt you have three options:

1. Place the cursor at the end of the all the code, `end` (`fn+right` on Macs lacking an `end` key).
2. Press `alt+enter`. This submits and prints the results un-altered.
3. Press `ctrl+enter`. This submits and will pretty print the results.

See also above about sending forms from the file editors to the REPL window for evaluation.

# Copy Last Results

There is a command for copying the last evaluation results, with the default keyboard shortcut: `ctrl+alt+c ctrl+c`.

This works regardless if you have evaluated in a file editor or in a REPL window.