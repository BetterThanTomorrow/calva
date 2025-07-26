---
title: The Output View
description: A read-only webview for REPL output.
---

The output view is a read-only view for REPL output. It's more performant than [the editor-based REPL window](repl-window.md). To see a feature comparison of all output destinations, see [Output Destinations Feature Comparison](output.md#output-destinations-feature-comparison).

![The output view, post jack-in](images/output-view/post-jack-in.png)

## Show the Output View

Run the Calva command "Show/Open the REPL Output View."

## Clear the Output View

Run the Calva command "Clear REPL Output View."

## Copy Code Snippets

To copy code in the output view, hover your cursor over the code snippet you want to copy. A "copy" button will appear in the top right corner of the code snippet. Click this button to copy the code to your clipboard.

![Copy button appearing and being clicked, then changing to Copied](images/output-view/copy-button.gif)

## Theming

The output view uses [highlight.js](https://highlightjs.org/) for syntax highlighting of code blocks. The theming of other output is controlled by VS Code. As you change the VS Code theme, the syntax hightlighting of code blocks will change to one of four different themes, one for each VS Code [ColorThemeKind](https://code.visualstudio.com/api/references/vscode-api#ColorThemeKind):

| ColorThemeKind | hightlight.js theme |
| -------------- | ------------------- |
| Dark | github-dark |
| Light | github |
| HighContrast | windows-high-contrast |
| HighContrastLight | windows-high-contrast-light |

![The output view code highlight theme changes as the VS Code theme changes](images/output-view/theme-changing.gif)

## Why is it read-only?

Calva actually had a read+write webview for REPL output in the past, but trying to emulate a terminal REPL that allowed input in a webview was a pain to maintain. Removing the input features and making the view just about _seeing the output_ makes development maintenance much simpler.

You may be used to typing "into the REPL," meaning typing into a terminal REPL or the [the editor-based REPL window](repl-window.md), but it's really not necessary or even really a great workflow. With Clojure and Calva, we can evaluate code directly from code files. This is the preferred method for some Clojurians. Using `comment` forms (Rich Comments) to evaluate code, we not only don't have to leave the file our cursor is currently in, but we have all the history of code we've evaluated right in a file, which we can save and commit, or remove later if we want.

!!! Tip "Quickly create Rich Comments with a Calva command"
    Use the Calva command "Add Rich Comment," which will add a `comment` form right below the form your cursor is currently at. Memorize the keyboard shortcut for this, and you can very easily create Rich Comments near the code you're working on to try out code in the REPL before adding it to your actual code.

!!! Note "Don't like adding scratch code to code files?"
    If you prefer not to leave scratch code in your code files or prefer not to have to remove it later, then create a separate scratch code file. This file can be your own personal scratch file, which you can commit, giving you a versioned history of all your scratch work, which may come in handy later. You may also want to use [fiddle files](fiddle-files.md).
