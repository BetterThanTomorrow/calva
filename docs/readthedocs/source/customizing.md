# Customizing Calva

Don't like the defaults? On this page we can collect some of the customizations that people have done, and maybe write a thing or two about it some day.

Tip For VS Code newcomers: The search box in **Settings** is your friend. Also, some Calva settings are more complex than the Settings UI can handle. VS Code will then show you a link to `settings.json`. And VS Code's built-in `json` extension is awesome. To add settings for, say Calva's Pretty Printing, search for ”prettyprint” in VS Code Settings and follow the link to `settings.json`. Start typing ”calvapretty” until auto-complete suggests `calva.prettyPrintingOptions`. Press ENTER and VS Code will fill in these defaults:

```json
    "calva.prettyPrintingOptions": {
        "enabled": true,
        "printEngine": "pprint",
        "width": 40
    },
```

## Clojure Defaults

Calva sets some VS Code settings for all Clojure files. Some of these are needed for Calva to function correctly, which should not be tampered with unless you really know what you are doing, and some of them are for convenience defaults. If you add a setting to your `settings.json` and accept the snippet help you get when you type `"[clojure]"`, you will get the Calva defaults pasted:

```json
    "[clojure]": {
        "editor.wordSeparators": "\t ()\"':,;~@#$%^&{}[]`",
        "editor.autoClosingBrackets": "always",
        "editor.autoClosingQuotes": "always",
        "editor.formatOnType": true,
        "editor.autoIndent": "full",
        "editor.formatOnPaste": true,
        "files.trimTrailingWhitespace": false,
        "editor.matchBrackets": "never",
        "editor.parameterHints.enabled": false
    }
```

### Automatic Parmaeter Hints Poppup

Calva has helpful parameter hints to aid when typing function calls. They look like so:

<img width="353" alt="image" src="https://user-images.githubusercontent.com/30010/75957543-8cf4c180-5eba-11ea-8d77-1e543a73ef28.png">

To have the hints automatically pop up when you are typing, set `editor.parameterHints.enabled` to `true` in the above `[clojure]` scoped setting. (To call them up on demand the default VS Code keybindings are `cmd+shift+space` on Mac and `ctrl+shift+space` on Linux/Windows.)

## Code Formatting

See [Formatting] for information on how to configure this.

## Jack-in and Connect Sequences

Jack-in and Connect are very customizable through [Custom Connect Sequences](connect-sequences.md).

## The REPL Window

If you don't want the REPL window to open automatically on jack-in/connect, set `calva.openREPLWindowOnConnect` to `false`. Please note, that if the [Connect Sequence](connect-sequences.md) you are using has `afterCLJReplJackInCode`, then the CLJ REPL window will open anyway in order to evaluate that code for you in a visible way.

### Default Key Bindings

The REPL Window prompt is a multi line editor, and the keyboard shortcuts facilitate this by default. The shortcuts can be configured however you like, and there are two preconfigured maps for it as well. You set this via the `calva.REPLWindowPromptKeyMap` setting:

| Prompt command | multi-line | single-line
| -------------- | ---------- | -----------
| **Submit** | <kbd>alt+enter</kbd> | <kbd>enter</kbd>
| **New line** | <kbd>enter</kbd> | <kbd>alt+enter</kbd>
| **Cursor Up** | <kbd>up</kbd> | <kbd>alt+up</kbd>
| **Cursor Down** | <kbd>down</kbd> | <kbd>alt+down</kbd>
| **History Up** | <kbd>alt+up</kbd> | <kbd>up</kbd>
| **History Down** | <kbd>alt+down</kbd> | <kbd>down</kbd>

As you might see, the simple pattern here is that in multi-line mode you move the cursor and enter new lines as in the regular editor, and use `alt` modifier to navigate the history and submit evaluations. In single-line mode it is the other way around.

## Pretty Printing

Calva's pretty printing mode can be configured a bit. See [Pretty Printing](pprint.md).

## Calva Highlight

Calva takes care of syntax highlighting, and also provides some features not available through VS Code's highlighting mechanism. These extras include rainbow parens, sane bracket matching, and comment form dimming/highlighting.

You are in charge of how brackets and comments are highlighted via the `calva.highlight.<setting>` settings:

| Setting | Meaning | Example |
| --- | ------- | ------- |
| `enableBracketColors` | Enable rainbow colors |  `true` |
| `bracketColors` | Which colors to use |  `["#000", "#999"]` |
| `cycleBracketColors` | Whether same colors should be reused for deeply nested brackets | `true` |
| `misplacedBracketStyle` | Style of misplaced bracket | `{ "border": "2px solid #c33" }` |
| `matchedBracketStyle` | Style of bracket pair highlight | `{"backgroundColor": "#E0E0E0"}` |
| `ignoredFormStyle` | Style of `#_...` form | `{"textDecoration": "none; opacity: 0.5"}` |
| `commentFormStyle` | Style of `(comment ...)` form | `{"fontStyle": "italic"}` |

The extras are built from **Clojure Warrior**, created by [Nikita Prokopov, a.k.a. @tonsky](https://tonsky.me)'s. Please note that the default styling for `(comment ...)` forms now is to italicize them (instead of dimming). This is to promote using `comment` forms to work with the REPL.

## Key bindings
* These key binds replace the default Calva ”prefix”, `ctrl+alt+c` to just `alt+v`: [WebWItch's keybindings.json](https://gist.github.com/conan/aa38688d7daa50804c8a433215dc6dc9) (Please note, that `alt+v` does not work for some locales, but for when it works it is much less clunky than the default prefix).
* Here the Calva key is switched for `ctrl+,`: [manas_marthi's keybindings](https://gist.github.com/pikeview/317f639091f57c3055681b06f0dc791a)
* [Keybindings for Emacs users](emacs-keybindings.md)

Are you a vim extension user? See: [Using with VIM extension](vim.md).

### Paredit

Please be aware that the REPL window does not handle chorded shortcuts. Something to keep in mind when customizing [Paredit](paredit.md) shortcuts, because those are dispatched onto the REPL window. So, best to avoid chorded shortcuts for Paredit.

## Wrap using `(`, `[`, `{` (like Cursive)

Something I use in IntelliJ/Cursive is the ability to select an expression and hit one of `(`, `[`, `{` to wrap it. And after wrapping the expression I don't want the selection anymore, so if I were wrapping `(foo)` then I would want to get `( | (foo))` where `|` would be my cursor.

Here's how you can make this work with Calva Paredit: Update all of the `Paredit: Wrap Around ...` commands so that their respective shortcuts are the wrappers themselves and update the `when` clause to include `editorHasSelection` (otherwise when you open a paren and the next expression would get slurped in).

The change would look like this in your `keybindings.json`:

```json
    {
        "key": "shift+9",
        "command": "paredit.wrapAroundParens",
        "when": "editorTextFocus && editorHasSelection && !editorReadOnly && editorLangId =~ /clojure|scheme|lisp/ && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "[",
        "command": "paredit.wrapAroundSquare",
        "when": "editorHasSelection && editorTextFocus && !editorReadOnly && editorLangId =~ /clojure|scheme|lisp/ && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "shift+[",
        "command": "paredit.wrapAroundCurly",
        "when": "editorHasSelection && editorTextFocus && !editorReadOnly && editorLangId =~ /clojure|scheme|lisp/ && paredit:keyMap =~ /original|strict/"
    }
```
