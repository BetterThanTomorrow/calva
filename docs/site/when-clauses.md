---
title: Calva When Clause Contexts
description: Calva comes with batteries included and preconfigured, and if you don't like the defaults, you can customize
---

# Calva When Clause Contexts

[When clause contexts](https://code.visualstudio.com/api/references/when-clause-contexts) is a powerful customization mechanism in VS Code. The most common use for end users is with keyboard shortcut bindings. Extensions can provide their own. The following contexts are available with Calva:

* `calva:keybindingsEnabled`: a master switch that you find in the settings
* `paredit:keyMap`: `strict`, `original`, or `none` from the corresponding Calva setting (see [Paredit](paredit.md))
* `calva:connected`: `true` when Calva is connected to a REPL (there is also `calva:connecting` || `calva:launching`)
* `calva:outputWindowActive`: `true` when the [Output/REPL window](output.md) has input focus
* `calva:replHistoryCommandsActive`: `true` when the cursor is in the Output/REPL window at the top level after the last prompt
* `calva:replWindowSubmitOnEnter`: `true` when the cursor is adjacent after the last top level form in the Output/REPL window
* `calva:cursorInString`: `true` when the cursor/caret is in a string or a regexp
* `calva:cursorInComment`: `true` when the cursor is in, or adjacent to a line comment
* `calva:cursorBeforeComment`: `true` when the cursor is adjacent before a line comment
* `calva:cursorAfterComment`: `true` when the cursor is adjacent after a line comment
* `calva:cursorAtStartOfLine`: `true` when the cursor is at the start of a line including any leading whitespace
* `calva:cursorAtEndOfLine`: `true` when the cursor is at the end of a line including any trailing whitespace
* `calva:projectRoot`: A string with the absolute path to the repl project root, _without trailing slash_
* `calva:ns`: A string with the current namespace
* `calva:replSessionType`: `clj`, or `cljs` depending on the file type of the current file
