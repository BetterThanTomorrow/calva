---
title: Parinfer
description: Learn how to leverage Calva Parinfer Mode for structural editing 
---

# Calva Parinfer Mode

[Parinfer](https://shaunlebron.github.io/parinfer/) is a system for editing the structure of LISP text without explicit commands. The structure can be regarded as already being expressed through indentation. With Parinfer you can use your intuition about the structure _inferred_ from the indentation to perform surprisingly many structural edits.

![Calva Parinfer](images/calva-parinfer-and-format-forward.gif)

## Infer Parens and Format Forward
Calva has two experimental features: **Infer Parens** (as you type), and the corresponding **Format Forward** (as you type). For now, they are both disabled by default. Enable them via these settings:

* `calva.fmt.experimental.inferParensAsYouType`
* `calva.fmt.experimental.formatForward`

They go best together. The first letting you use indentation to decide structure, the latter using the structure to let you keep the code indented properly as you type.

!!! Note "About `editor.autoClosingBrackets` and infering the closing bracket"
    TL;DR: When enabling `calva.fmt.experimental.inferParensAsYouType`, _you need to also disable `editor.autoClosingBrackets`_.

    For Parinfer's inference of the closing bracket when you type an opening one to work, VS Code's built-in `editor.autoClosingBrackets` setting needs to be **disabled**, and Calva currently **enables** this by default. This is because there are currently some troubles with Calva's backup auto-closing features (`calva.paredit.strictAutoClosingBrackets`).

!!! Note "Multi-cursors not fully supported"
    Calva only really considers the first cursor in a multi-cursor senario. Sometimes that's enough, often it is not.

## Paredit is still there

In Calva, Parinfer and [Paredit](paredit.md) are designed to coexist and both be there to let you edit the structure easily and efficiently. Since Pardit commands are always formatted, they leave the code in a state where Parinfer has what it needs to infer bracket placement as you either edit the indentation, or remove/add brackets.

## Disable the Parinfer Extension

If you want to have Parinfer you are probably best served by Calva's built-in version. It is designed, and will continue to be improved to function well together with Calva's other structural editing and formatting features. _It will also probably conflict with the Parinfer Extension._

## See also

* [Paredit](paredit.md)
* [Formatting](formatting.md)