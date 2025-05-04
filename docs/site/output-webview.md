---
title: The Output Webview
description: A read-only webview for REPL output.
---

The output webview is a read-only webview for REPL output. It's more performant than [the editor-based REPL window](repl-window.md).

## Show the Output Webview

Run the Calva command "Show/Open the REPL Output Webview", which is enabled when a REPL is connected to Calva.

## Clear the Output Webview

Run the Calva command "Clear REPL Output Webview".

## Theming

The output webview uses [highlight.js](https://highlightjs.org/) for syntax highlighting of code blocks. The theming of other output is controlled by VS Code. As you change the VS Code theme, the syntax hightlighting of code blocks will change to one of four different themes, one for each VS Code [ColorThemeKind](https://code.visualstudio.com/api/references/vscode-api#ColorThemeKind):

| ColorThemeKind | hightlight.js theme |
| -------------- | ------------------- |
| Dark | github-dark |
| Light | github |
| HighContrast | windows-high-contrast |
| HighContrastLight | windows-high-contrast-light |

## Why is it read-only?

Calva actually had a read+write webview for REPL output in the past, but trying to emulate a terminal REPL that allowed input in a webview was a pain to maintain. Removing the input features and making the view just about _seeing the output_ makes development maintenance much simpler.

You may be used to typing "into the REPL" - meaning typing into a terminal REPL or the [the editor-based REPL window](repl-window.md), but it's really not necessary or even really an great workflow. With Clojure and Calva, we can evaluate code directly from code files. This is a preferred method of some. Using `comment` forms (Rich Comments) to evaluate code, we not only don't have to leave the file our cursor is currently in, but we have all the history of code we've evaluated right in a file, which we can save and commit, or remove later if we want.

!!! Tip "Quickly create a Rich Comments with a Calva command"
    Use the Calva command "Add Rich Comment", which will add a `comment` form right below the form you cursor is currently at. Memorize the keyboard shortcut for this, and you can very easily create Rich Comments near the code you're working on to try out code in the REPL before adding it to your actual code.
