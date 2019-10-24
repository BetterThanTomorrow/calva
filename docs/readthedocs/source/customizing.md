# Customizing Calva

Don't like the defaults? On this page we can collect some of the customizations that people have done, and maybe write a thing or two about it some day.

## Calva Highlight

Calva takes care of syntax highlighting, and also provides some features not available through VS Code's highlighting mechanism. These extras include rainbow parens, sane bracket matching, and comment form dimming/highlighting.

You are in charge of how brackets and comments are highlighted:

| Setting | Meaning | Example |
| --- | ------- | ------- |
| `"calva.highlight.enableBracketColors"` | Enable rainbow colors |  `true` |
| `"calva.highlight.bracketColors"` | Which colors to use |  `["#000", "#999"]` |
| `"calva.highlight.cycleBracketColors"` | Whether same colors should be reused for deeply nested brackets | `true` |
| `"calva.highlight.misplacedBracketStyle"` | Style of misplaced bracket | `{ "border": "2px solid #c33" }` |
| `"calva.highlight.matchedBracketStyle"` | Style of bracket pair highlight | `{"backgroundColor": "#E0E0E0"}` |
| `"calva.highlight.ignoredFormStyle"` | Style of `#_...` form | `{"textDecoration": "none; opacity: 0.5"}` |
| `"calva.highlight.commentFormStyle"` | Style of `(comment ...)` form | `{"fontStyle": "italic"}` |

The extras are built from **Clojure Warrior**, created by [Nikita Prokopov, a.k.a. @tonsky](https://tonsky.me)'s. Please note that the default styling for `(comment ...)` forms now is to italicize them (instead of dimming). This is to promote using `comment` forms to work with the REPL.

## Keyword highlighting
Many VS Code themes lack special highlighting of keywords. You can amend your theme by putting something like this in your `settings.json`:

```json
{
    "editor.tokenColorCustomizations": {
        "[Default Dark+]": {
            "textMateRules": [
                {
                    "scope": [
                        "constant.keyword.clojure"
                    ],
                    "settings": {
                        "foreground": "#9cdcfeff"
                    }
                }
            ]
        },
    }
}
```

Please update this with the settings you find you like for your theme.

## Key bindings
* These key binds replace the default Calva ”prefix”, `ctrl+alt+v` to just `alt+v`: [WebWItch's keybindings.json](https://gist.github.com/conan/aa38688d7daa50804c8a433215dc6dc9) (Please note, that `alt+v` does not work for some locales, but for when it works it is much less clunky than the default prefix).
* Here the Calva key is switched for `ctrl+,`: [manas_marthi's keybindings](https://gist.github.com/pikeview/317f639091f57c3055681b06f0dc791a)
* [Keybindings for Emacs users](emacs-keybindings.md)

Are you a vim extension user? See: [[Using with VIM extension]].


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
