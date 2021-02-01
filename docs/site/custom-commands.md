# Running Custom REPL Commands

Calva supports configuration of custom command snippets that you can execute in the REPL at will. If your workflow has you repeatedly evaluate a particular piece of code, you can use the setting `calva.customREPLCommandSnippets` to configure it and then use the command **Run Custom REPL Command** to access it. The command will give you a menu with the snippets you have configured.

The `calva.customREPLCommandSnippets` is an array of objects with the following fields:

* `name`: The name of the snippet as it will appear in the picker menu
* `snippet`: The code that will be evaluated
* `ns`: (optional) Namespace to evaluate the command in. If omitted the command will be executed in the namespace of the current editor.
* `repl`: Which repl session to use for the evaluation. Either `"clj"` or `"cljs"`

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
            "repl": "clj",
            "snippet": "($top-level-form)"
        },
        {
            "name": "Tap Current Form",
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


Issuing **Run Custom REPL Command** will render this VS Code menu:

![](images/custom-command-menu.png)

The items are numbered for you so that you can choose them in predictable way. The default keyboard shortcut for the command is `ctrl+alt+space`. Which means that to execute the **Tap Current Form** custom command, you could do:

`ctrl+alt+space 6 enter`.