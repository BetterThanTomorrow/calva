# Running Custom REPL Commands

Calva supports configuration of custom command snippets that you can execute in the REPL at will. If your workflow has you repeatedly evaluate a particular piece of code, you can use the setting `calva.customREPLCommandSnippets` to configure it and then use the command **Run Custom REPL Command** to access it. The command will give you a menu with the snippets you have configured.

The `calva.customREPLCommandSnippets` is an array of objects with the following fields:

* `name`: The name of the snippet as it will appear in the picker menu
* `snippet`: The code that will be evaluated
* `ns`: (optional) Namespace to evaluate the command in. If omitted the command will be executed in the namespace of the current editor.
* `repl`: Which repl session to use for the evaluation. Either `"clj"` or `"cljs"`

E.g. with these settings:

```
    "calva.customREPLCommandSnippets": [
        {
            "name": "Foo",
            "snippet": "(println :foo)",
            "ns": "acme.test.foo-test",
            "repl": "cljs"
        },
        {
            "name": "Bar",
            "snippet": "(println :bar)",
            "ns": "acme.test.bar-test",
            "repl": "clj"
        },
        {
            "name": "Refresh",
            "snippet": "(refresh)",
            "repl": "clj"
        }
    ]
```

You will get this menu.

<img width="601" alt="image" src="https://user-images.githubusercontent.com/30010/66232206-9bab3280-e6e8-11e9-872b-22fd50baef25.png">

The items are numbered for you so that you can choose them in predictable way. The default keyboard shortcut for the command is <kbd>ctrl</kbd>+<kbd>alt</kbd>+<kbd>c</kbd>, <kbd>.</kbd>. Which means that to execute the **Refresh** command, `(refresh)`, in the `clj` REPL, you could do:

<kbd>ctrl</kbd>+<kbd>alt</kbd>+<kbd>c</kbd>, <kbd>.</kbd>, <kbd>3</kbd>, <kbd>ENTER</kbd>.