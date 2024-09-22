---
title: Evaluate Clojure Code
description: Calva goes to great lengths to make it easy to evaluate code, supporting interactive development
search:
  boost: 7
---

# Code Evaluation

Calva tries to make it easy to evaluate code, supporting interactive development. The fastest path to learning about it is to use the **Create a Getting Started REPL project** command, which you can learn more about in the [Getting Started](getting-started.md) section.

NB: _The below assumes you have read about [Finding Calva Commands and Shortcuts](finding-commands.md)._

## Interrupting/stopping running evaluations

Sometimes you evaluate things that take a very long time to complete, or might not even ever complete (infinite loops, lazy sequences, things like that). Calva has a command for interrupting running evaluations. You find it in the VS Code command palette, as well as in the REPL status bar item menu, when the REPL is connected.

## Evaluation in a File Editor

Calva has many commands for evaluating forms, including the **current form** and the **current top-level form**.

Some of the commands also let you choose what should happen with the results:

1. **Inline.** This will display the results (or some of it, if it is long) inline in the editor.
     * This also creates a hover pane including the full results and a button which will copy the results to the clipboard.
     * There is also a command for copying the last result to the clipboard.
     * The full results are always available in the [output destination](output.md).
         * There is a command for showing the output destination, allowing for a workflow where you either generally have it closed, or have it as one of the tabs in the same editor group as the files you are working with.
1. **To comments.** This will add the results as line comments below the current line.
1. **Replace the evaluated code.** This will do what it says, the evaluated code will be replaced with its results.

??? Note "Evaluate to comments support different comment styles"
    When using the commands for evaluating to comments, **Evaluate Top Level Form (defun) to Comment**, and **Evaluate Selection to Comment**, the commands will insert the results as line comments (`;; ...`) below the evaluated form. However, there are two additional comment styles available. To use these you need to execute the commands via VS Code API, typically from keybindings. The commands take an argument map with the key `commentStyle`. You can choose between three different comment styles: `line`, `ignore`, and `rcf`:

    * The `line` style is the default.
    * The `ignore` style will put an ignore marker (`#_`) before the result.
    * The `rcf` style will wrap the result in a rich comment form ( `(comment ...)`).
    
    Here are some example keybindings for using the different comment styles with the **Evaluate Top Level Form (defun) to Comment** command:

    ```jsonc
    {
      "key": "ctrl+alt+c ctrl+space",
      "command": "calva.evaluateTopLevelFormAsComment",
      "when": "editorTextFocus && editorLangId == 'clojure'",
      "args": {
        "commentStyle": "line"
      }
    },
    {
      "key": "ctrl+alt+c ctrl+i",
      "command": "calva.evaluateTopLevelFormAsComment",
      // "command": "calva.evaluateSelectionAsComment",
      "when": "editorTextFocus && editorLangId == 'clojure'",
      "args": {
        "commentStyle": "ignore"
      }
    },
    {
      "key": "ctrl+alt+c ctrl+r",
      "command": "calva.evaluateTopLevelFormAsComment",
      // "command": "calva.evaluateSelectionAsComment",
      "when": "editorTextFocus && editorLangId == 'clojure'",
      "args": {
        "commentStyle": "rcf"
      }
    },
    ```

    The first keybinding there is the default for the command, and only included as an example.

## Wait, Current Form? Top-level Form?

These are important concepts in Calva in order for you to create your most effective workflow. This video explains it a bit:

<iframe width="560" height="315" src="https://www.youtube.com/embed/8ygw7LLLU1w" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

### Current Form

Default shortcut for evaluating the current form: `ctrl+enter`.

The **current form** either means the current selection, or otherwise is based on the cursor position. Play some with the command **Calva: Select current form**, `ctrl+alt+c s`, to figure out what Calva thinks is the current form for some different situations. Try it inside a symbol, adjacent to a symbol (both sides) and adjacent to an opening or closing bracket (again, both sides). Generally the current form is determined like so:

1. If text is selected, then that text
1. If the cursor is ”in” a symbol, then that symbol
   ```clojure
   foob|ar ; foobar
   ```
1. If the cursor is adjacent to a form (a symbol or a list of some kind), then that form
   ```clojure
   (foo bar |(baz)) ; (baz)
   ```
1. If the cursor is between to forms, then the left side form
   ```clojure
   (foo bar | (baz)) ; bar
   ```
1. If the cursor is before the first form of a line, then that form
   ```clojure
   (foo
   | bar (baz)) ; bar
   ```

### Current Top-level Form

Default shortcut for evaluating the current top level form: `alt+enter`.

The **current top-level form** means top-level in a structural sense. It is _not_ the topmost form in the file. Typically in a Clojure file you will find `def` and `defn` (and `defwhatever`) forms at the top level, which also is one major intended use for evaluating top level form: _to define and redefine variables_. However, Calva does not check the contents of the form in order to determine it as a top-level forms: _all forms not enclosed in any other form are top level forms_.

An ”exception” is introduced by the `comment` form. It will create a new top level context, so that any forms immediately inside a `(comment ...)` form will be considered top-level by Calva. This is to support a workflow with what is often referred to the [Rich Comments](rich-comments.md).

At the top level the selection of which form is the current top level form follows the same rules as those for [the current form](#current-form).

### Evaluate Enclosing Form

The default keyboard shortcut for evaluating the current enclosing form (the list the cursor is in) is `ctrl+shift+enter`.

```clojure
(let [foo :bar]
  (when false (str| foo))) ; => ":bar"
```

### Evaluate to Cursor

There are several commands for evaluating a piece of code, closing brackets. It's good, especially in threads, but can also come in handy in other situations, for instance when you want to evaluate something that depends on bindings, such as in a `let` form.

### Evaluate From Start of List to Cursor, Closing Brackets

This command evaluates the text from the start of the current enclosing list to where the cursor is, and it adds the missing closing bracket for you. Convenient for checking intermediate results in thread or `doto`, or similar pipelines. The cursor is right behind `:d` in this form:

```clojure
  (->> [1 1 2 3 5 8 13 21]
       (partition 2)
       (zipmap [:a :b :c :d])
       :d| ; => (13 21)
       (apply -)
       (Math/abs))
```

The default shortcut for this command is <kbd>ctrl+alt+enter</kbd>.

### Evaluate Selection, Closing Brackets

This is the most versatile of the ”evaluation, closing brackets” commands. It will do what it says. 😄 It's extra handy in combination with the command **Paredit: Select Backward Up Sexp/Form** (<kbd>shift+ctrl+up</kbd>). Consider this contrieved form (buggy code, because it was supposed to result in `42`, not `-42`):

```clojure
(defn fortytwo-from-thirty
  []
  (let [thirty 30]
    (-> thirty
        inc            ;1
        (send-off)
        (+ 1 2 3)
        (->>
         (+ 2 2)       ;2
         (+))
        list
        (->>
         (into [1])
         (reduce + 1))
        (- 1)          ;3
        (* -1))))
```

At `;1`, you can do **backward up sexp** (<kbd>shift+ctrl+up</kbd>) twice to select up to the `(let ..)`, then issue **Evaluate Selection, Closing Brackets**. It has the same default keybinding as the command for [evaluating the current list up to the cursor](#evaluate-from-start-of-list-to-cursor-closing-brackets): <kbd>ctrl+alt+enter</kbd>.

At `;2` you need select backwards up three times.

`;3` is included because it is close to the bug. (Which was introduced when the thread-last, `->>` was added to make this example.) Please practice the **Evaluate Selection, Closing Brackets** command to fix the bug.

### Evaluate From Start of Top Level Form to Cursor, Closing Brackets

This command has a default shortcut keybinding of `shift+alt+enter`. It will create a form from the start of the current top level form, up to the cursor, close all brackets, and this will then be evaluated. Good for examining code blocks up to a certain point. Often comes in handy in Rich comments (`(comment ...)`).

Take this example and paste it in a file loaded into the REPL, then place the cursor in front of each line comment and try the command.

```clojure
(comment
 (do
   (def colt-express
     {:name "Colt Express"
      :categories ["Family"
                   "Strategy"]
      :play-time 40
      :ratings {:pez 5.0
                :kat 5.0
                :wiw 5.0   ; 1, then eval `colt-express`
                :vig 3.0
                :rex 5.0
                :lun 4.0}})

   (defn average [coll]
     (/ (apply + coll) (count coll)))

   (let [foo-express (-> colt-express
                         (assoc :name "Foo Express")
                         (assoc-in [:ratings :lyr] 5.0)
                         (update-in [:ratings :vig] inc))]
     (->> foo-express   ; 2
          :ratings      ; 3
          vals          ; 4
          average       ; 5
          ))))
```

### Evaluate From Start of File to Cursor, Closing Brackets

Yup, that command also exists. 😄

## Copying the inline results

There is a command called **Copy last evaluation results**, `ctrl+alt+c ctrl+c`.

This works regardless if you have evaluated in a file editor or in a REPL window.

## Evaluating in a REPL window

Since the REPL Window is mostly just a regular file, things work pretty similar at the REPL prompt. You use `alt+enter` to evaluate. Selecting the current form (default key binding `ctrl+w` on Mac and `shift+alt+right` on Windows and Linux) after evaluating will select the result.
