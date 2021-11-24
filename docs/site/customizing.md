---
title: Customizing Calva
description: Calva comes with batteries included and preconfigured, and if you don't like the defaults, you can customize
---

# Customizing Calva

Don't like the defaults? On this page we can collect some of the customizations that people have done, and maybe write a thing or two about it some day.

Tip for VS Code newcomers: The search box in **Settings** is your friend. Also, some Calva settings are more complex than the Settings UI can handle. VS Code will then show you a link to `settings.json`. And VS Code's built-in `json` extension is awesome. To add settings for Calva's Pretty Printing, for example, search for ”prettyprint” in VS Code Settings and follow the link to `settings.json`. Start typing ”calvapretty” until auto-complete suggests `calva.prettyPrintingOptions`. Press ENTER and VS Code will fill in these defaults:

```json
    "calva.prettyPrintingOptions": {
        "enabled": true,
        "printEngine": "pprint",
        "width": 40
    },
```

## Clojure Defaults

Calva sets some VS Code settings for all Clojure files. Some of these are needed for Calva to function correctly, which should not be tampered with unless you really know what you are doing, and some of them are convenient defaults. If you add a setting to your `settings.json` and accept the snippet help you get when you type `"[clojure]"`, you will get the Calva defaults pasted:

```json
    "[clojure]": {
        "editor.wordSeparators": "\t ()\"':,;~@#$%^&{}[]`",
        "editor.autoClosingBrackets": "always",
        "editor.autoClosingOvertype": "always",
        "editor.autoClosingQuotes": "always",
        "editor.formatOnType": true,
        "editor.autoIndent": "full",
        "editor.formatOnPaste": true,
        "files.trimTrailingWhitespace": false,
        "editor.matchBrackets": "never",
        "editor.guides.indentation": false,
        "editor.parameterHints.enabled": false
    }
```

!!! Note "`editor.wordSeparators`"
    The above `editor.wordSeparators` setting establish Clojure word boundaries. E.g `-` is considered to be part of words. This affects what happens when double-clicking symbols and other things. If you want to include `-` or something else as a word boundary, just add it to the setting.

## Pretty Printing

Calva's pretty printing mode can be configured a bit. See [Pretty Printing](pprint.md).

## Calva Highlight

See [Clojure Syntax Highlighting](highlight.md) for customization options.

## Automatic Parameter Hints Poppup

Calva has helpful parameter hints to aid when typing function calls. They look like so:

<img width="353" alt="image" src="https://user-images.githubusercontent.com/30010/75957543-8cf4c180-5eba-11ea-8d77-1e543a73ef28.png">

To have the hints automatically pop up when you are typing, set `editor.parameterHints.enabled` to `true` in the above `[clojure]` scoped setting. (To call them up on demand the default VS Code keybindings are `cmd+shift+space` on Mac and `ctrl+shift+space` on Linux/Windows.)

## Code Formatting

See [Formatting](formatting.md) for information on how to configure this.

## Jack-in and Connect Sequences

Jack-in and Connect are very customizable through [Custom Connect Sequences](connect-sequences.md).

## Jack-in Dependency Versions

The versions of the dependencies [Calva Jack-in](jack-in-guide.md) injects in order for the REPL session to support IDE features are configurable via the VS Code settings `calva.jackInDependencyVersions`. At the time of this writing the default versions are:

Dependency | Version | Description
---------- | ------- | -----------
[nrepl](https://github.com/nrepl/nrepl) | 0.8.3 | nREPL is the wonderful piece of software that gives Calva a structured and extensible connection to the REPL in your Clojure and ClojureScript projects.
[cider-nrepl](https://github.com/clojure-emacs/cider-nrepl) | 0.25.8 | cider-nrepl is middleware that extends the nREPL connection with all sorts of nice stuff that Calva uses to give you a delightful IDE experience.
[cider/piggieback](https://github.com/nrepl/piggieback) | 0.5.2 | Piggieback is used to create nREPL sessions in ClojureScript projects. (Not with [shadow-cljs](http://shadow-cljs.org) projects though, which provides its own middleware for this.)

## Key bindings

Most of Calva's commands have default keybindings. They are only defaults, though, and you can change keybindings as you wish. To facilitate precision in binding keys Calva keeps some [when clause contexts](https://code.visualstudio.com/api/references/when-clause-contexts) updated. 

### When Clause Contexts

The following contexts are available with Calva:

* `calva:keybindingsEnabled`: a master switch that you find in the settings
* `paredit:keyMap`: `strict`, `original`, or `none` from the corresponding Calva setting (see [Paredit](paredit.md))
* `calva:connected`: `true` when Calva is connected to a REPL (there is also `calva:connecting` || `calva:launching`)
* `calva:outputWindowActive`: `true` when the [Output/REPL window](output.md) has input focus
* `calva:replHistoryCommandsActive`: `true` when the cursor is in the Output/REPL window at the top level after the last prompt
* `calva:outputWindowSubmitOnEnter`: `true` when the cursor is adjacent after the last top level form in the Output/REPL window
* `calva:cursorInString`: `true` when the cursor/caret is in a string or a regexp
* `calva:cursorInComment`: `true` when the cursor is in, or adjacent to a line comment
* `calva:cursorBeforeComment`: `true` when the cursor is adjacent before a line comment
* `calva:cursorAfterComment`: `true` when the cursor is adjacent after a line comment
* `calva:cursorAtStartOfLine`: `true` when the cursor is at the start of a line including any leading whitespace
* `calva:cursorAtEndOfLine`: `true` when the cursor is at the end of a line including any trailing whitespace
* `calva:showReplUi`: `false` when Calva's REPL UI is disabled through the corresponding setting

### Some Custom Bindings 

Here is a collection of custom keybindings from here and there.

* Replace all Calva `ctrl+alt+...` key bindings with `ctrl+shift+...`, for keyboards lacking `alt` key: [this gist](https://gist.github.com/PEZ/3fc22e015e0d33fb9b73074fd6abf292)
* Replace the default Calva ”prefix”, `ctrl+alt+c` to just `alt+v`: [WebWItch's keybindings.json](https://gist.github.com/conan/aa38688d7daa50804c8a433215dc6dc9) (Please note, that `alt+v` does not work for some locales, but for when it works it is much less clunky than the default prefix).
* Here the Calva key is switched for `ctrl+,`: [manas_marthi's keybindings](https://gist.github.com/emelens/317f639091f57c3055681b06f0dc791a)
* [Keybindings for Emacs users](emacs-keybindings.md)

Are you a vim extension user? See: [Using with VIM extension](vim.md).

### Move by word

By default Calva changes the move-by-word key bindings to move by sexpr/form when the cursor is in structural Clojure code. _Within line comments the editor default word movement is active._

If you want the VS Code default word movement shortcuts, use these settings:

```json
    {
        "key": "ctrl+right",
        "win": "ctrl+right",
        "mac": "alt+right",
        "command": "cursorWordRight"
    },
    {
        "key": "ctrl+left",
        "win": "ctrl+left",
        "mac": "alt+left",
        "command": "cursorWordLeft"
    },
    {
        "key": "ctrl+right",
        "mac": "ctrl+right",
        "win": "alt+right",
        "command": "paredit.forwardSexp",
        "when": "calva:keybindingsEnabled && editorTextFocus && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+left",
        "mac": "ctrl+left",
        "win": "alt+left",
        "command": "paredit.backwardSexp",
        "when": "calva:keybindingsEnabled && editorTextFocus && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    }
```

Use it as an inspiration for customizing things to your own liking. 😄

### Wrap using `(`, `[`, `{` (like Cursive)

Something I use in IntelliJ/Cursive is the ability to select an expression and hit one of `(`, `[`, `{` to wrap it. And after wrapping the expression I don't want the selection anymore, so if I were wrapping `(foo)` then I would want to get `( | (foo))` where `|` would be my cursor.

Here's how you can make this work with Calva Paredit: Update all of the `Paredit: Wrap Around ...` commands so that their respective shortcuts are the wrappers themselves and update the `when` clause to include `editorHasSelection` (otherwise when you open a paren the next expression would get slurped in).

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
