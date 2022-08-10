---
title: Clojure Notebooks
description: Work with Clojure notebook files directly in VSCode
search:
  boost: 1
---

!!! Note "Notebook support is experimental"

    We're currently working on the tooling around autocomplete, go to def, linting and such.

    We're looking forward to any feedback.

You can open any clojure file as a notebook by right clicking the file -> `Open with...` -> `Calva Notebook`.

Running cells sends them to the repl and pretty prints the results. If the return is a string that starts with `<html` it will be displayed in an html webview.

