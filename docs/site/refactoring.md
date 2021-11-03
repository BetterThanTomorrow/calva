---
title: Refactoring
description: Powered by clojure-lsp, Calva comes with some quite nifty refactoring support
---

# Refactoring

There are two ”flavours” to refactoring support. Some (just a few) refactorings are made available as _Quick Fix_ suggestions (the light bulb), the rest are regular commands in the *Calva Refactoring* category.

![](images/refactoring/quick-fix.png)

You can enable or disable the _Quick Fix_ suggestion lightbulb using the VS Code setting `editor.lightbulb.enabled`.

The refactoring commands do not have default keyboard shortcuts. You find them all by typing ”Calva Refactor” in the Command Palette.

## Commands

Command Title | Command Key | Description
------------- | ----------- | -----------
Clean NS Form | `calva.refactor.cleanNs` | ![](images/refactoring/cleanNs.gif)
Add Missing Require | `calva.refactor.addMissingLibspec` | ![](images/refactoring/addMissingLibspec.gif)
Extract to New Function | `calva.refactor.extractFunction` | ![](images/refactoring/extractFunction.gif)
Cycle/Toggle Privacy | `calva.refactor.cyclePrivacy` | ![](images/refactoring/cyclePrivacy.gif)
Inline Symbol | `calva.refactor.inlineSymbol` | ![](images/refactoring/inlineSymbol.gif)
Introduce let | `calva.refactor.introduceLet` | Creates a new let box with the binding. Follow up with ”Expand let” to move it upwards.<br>![](images/refactoring/introduceLet.gif)
Expand Let | `calva.refactor.expandLet` | ![](images/refactoring/expandLet.gif)
Move to Previous let Box | `calva.refactor.moveToLet` | ![](images/refactoring/moveToLet.gif)
Thread First | `calva.refactor.threadFirst` | ![](images/refactoring/threadFirst.gif)
Thread First All | `calva.refactor.threadFirstAll` | ![](images/refactoring/threadFirstAll.gif)
Thread Last | `calva.refactor.threadLast` | ![](images/refactoring/threadLast.gif)
Thread Last All | `calva.refactor.threadLastAll` | ![](images/refactoring/threadLastAll.gif)
Unwind All | `calva.refactor.unwindAll` | ![](images/refactoring/unwindAll.gif)
Unwind Thread | `calva.refactor.unwindThread` | ![](images/refactoring/unwindThread.gif)

!!! Note "Formatting"
    The way that some of the refactorings are applied to the document, makes it difficult for Calva to format the results. So, sometimes you'll need to navigate the cursor to the enclosing form and hit `tab` to tidy up the formatting after a refactoring. See also [Formatting](formatting.md).

## Thanks to clojure-lsp

Most of Calva's refactoring support is sourced directly from [clojure-lsp](clojure-lsp.md). This also means that most often, if you find issues with refactoring, or have suggestions about it, the clojure-lsp repo is where to direct your reporting.