---
title: Clojure Notebooks
description: Work with Clojure notebook files directly in VSCode
search:
  boost: 1
---

!!! Warning "WIP: Notebook support is very basic and experimental"
    * You might experience loss of file contents when saving a Clojure Notebook. _Have backups of any files you open as notebooks._
    * Tooling around autocomplete, go to def, linting and such does not work at all yet.
    * There is no Markdown support.
    * Etcetera.
    As if this was not enough, notebooks can also interfere with [LiveShare support](live-share.md).

    Please help test the feature. We're looking forward to your feedback!

You can open any Clojure file as a notebook by right clicking the file -> `Open with...` -> `Clojure Notebook`.

Running cells sends them to the REPL and pretty prints the results. If the return is a string that starts with `<html` it will be displayed in an html webview.

Forms inside `(comment)` blocks get shown as their own cells. When adding code blocks in between those cells they get saved with the same indentation as the first form.

## Calva Spritz

Together with Calva there is an extension called **Calva Spritz** installed. It only provides the association of Clojure file types to Clojure Notebooks. This is due to the LiveShare issues mentioned above. So that you can disable the Notebook association when participating as a guest in LiveShare sessions. The issue is tracked here:

* Calva issue: [LiveShare participants incorrectly opening every Clojure file as if via "Open with Notebook"](https://github.com/BetterThanTomorrow/calva/issues/1850)
* LiveShare issue: [Guest opens Clojure file as a notebook (incorrectly)](https://github.com/MicrosoftDocs/live-share/issues/4765)