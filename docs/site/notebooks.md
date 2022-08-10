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

   Please help test the feature. We're looking forward to your feedback!

You can open any clojure file as a notebook by right clicking the file -> `Open with...` -> `Calva Notebook`.

Running cells sends them to the REPL and pretty prints the results. If the return is a string that starts with `<html` it will be displayed in an html webview.

