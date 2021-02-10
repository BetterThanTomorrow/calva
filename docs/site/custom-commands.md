# Custom REPL Commands

Calva supports configuration of custom command snippets that you can evaluate in the REPL at will. If your workflow has you repeatedly evaluate a particular piece of code, you can use the setting `calva.customREPLCommandSnippets` to configure it. Then either bind keyboard shortcuts to them or use the command **Run Custom REPL Command** to access it. The command will give you a menu with the snippets you have configured.

The `calva.customREPLCommandSnippets` is an array of objects with the following fields (required fields in **bold**):

* **`name`**: The name of the snippet as it will appear in the picker menu
* **`snippet`**: The code that will be evaluated
* `key`: A key can be used to reference the snippet from **Run Custom REPL Command** keyboard shortcut arguments. It will also be used in the quick-pick menu.
* `ns`: A namespace to evaluate the command in. If omitted the command will be executed in the namespace of the current editor.
* `repl`: Which repl session to use for the evaluation. Either `"clj"` or `"cljs"`. Omit if you want to use the session of the current editor.

There are also substitutions available, which will take elements from the current state of Calva and splice them in to the text of your command before executing it. They are

* `$line`: Current line number in editor
* `$column`: Current column number in editor
* `$file`: Full name of current file edited
* `ns`: The namespace used for evaluating the command
* `$current-form`: The text of the [current form](eval-tips.md#current-form)
* `$top-level-form` The text of the [current top level form](eval-tips.md#current-top-level-form)
* `$current-fn`: The sexpr/form at call position in the current list, e.g. `str` with `(defn foo [] (str "foo" "bar|"))`
* `$top-level-defined-symbol`: The second symbol of the top level form, e.g. `foo` with `(defn foo [] (str "foo" "bar|"))`

Consider these settings:

```json
        "calva.customREPLCommandSnippets": [
        {
            "name": "Foo",
            "snippet": "(println :foo)",
            "ns": "acme.test.foo-test",
            "repl": "cljs"
        },
        {
            "name": "Bar",
            "snippet": "(println :bar $line)",
            "ns": "acme.test.bar-test",
            "repl": "clj"
        },
        {
            "name": "Refresh",
            "key": "r",
            "snippet": "(refresh)",
            "repl": "clj"
        },
        {
            "name": "Call Current Form",
            "repl": "clj",
            "snippet": "($current-form)"
        },
        {
            "name": "Call Current Top Level Form",
            "key": "call-t",
            "repl": "clj",
            "snippet": "($top-level-form)"
        },
        {
            // You don't need to configure this one,
            // there is a built-in command for tapping the current form
            "name": "Tap Current Form",
            "key": "tap",
            "repl": "clj",
            "snippet": "(tap> $current-form)"
        },
        {
            "name": "Evaluate Current Function Symbol",
            "repl": "clj",
            "snippet": "$current-fn"
        },
        {
            "name": "Call Top Level Defined Symbol",
            "repl": "clj",
            "snippet": "($top-level-defined-symbol)"
        }
    ]
```


Issuing **Run Custom REPL Command** will then render this VS Code menu:

![](images/custom-command-menu.png)

The items are numbered for you so that you can choose them in predictable way. The default keyboard shortcut for the command is `ctrl+alt+space`. Which means that to execute the **Call Current Form** custom command, you could do:

`ctrl+alt+space 4 enter`.

## Binding keyboard shortcuts

Some custom REPL commands might be so central to your workflow that you want to bind keyboard shortcuts to them directly. There are two ways to do this:

1. Bind `calva.runCustomREPLCommand` to a shortcut with whatever code you want to evaluate in `args` key. You have access to the substitution variables here as well.
2. Bind `calva.runCustomREPLCommand` to a shortcut referencing the `key` of on of your `calva.customREPLCommandSnippets`.

Given the above example settings, here are two shortcut definitions that both `tap>` the current form:

```json
    {
        "key": "ctrl+alt+shift+t t",
        "command": "calva.runCustomREPLCommand",
        "args": "(tap> $current-form)"
    },
    {
        "key": "ctrl+alt+shift+t t",
        "command": "calva.runCustomREPLCommand",
        "args": "tap"
    }
```

(Again, none of them is needed, the built in command for tapping the current form is default bound to the shortcut `ctrl+shift+t t`.)