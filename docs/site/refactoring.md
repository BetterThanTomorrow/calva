---
title: Refactoring
description: Powered by clojure-lsp, Calva comes with some quite nifty refactoring support
---

# Refactoring

There are two ”flavours” to refactoring support. Some (just a few) refactorings are made available as _Quick Fix_ suggestions (the light bulb), the rest are regular commands in the *clojure-lsp Refactoring* category.

![](images/refactoring/quick-fix.png)

You can enable or disable the _Quick Fix_ suggestion lightbulb using the VS Code setting `editor.lightbulb.enabled`.

The refactoring commands do not have default keyboard shortcuts. You find them all by typing ”clojure-lsp Refactor” in the Command Palette.

## Commands

Command Title | Command Key | Description
------------- | ----------- | -----------
Clean NS Form | `clojureLsp.refactor.cleanNs` | ![](images/refactoring/cleanNs.gif)
Add Missing Require | `clojureLsp.refactor.addMissingLibspec` | ![](images/refactoring/addMissingLibspec.gif)
Extract to New Function | `clojureLsp.refactor.extractFunction` | ![](images/refactoring/extractFunction.gif)
Cycle/Toggle Privacy | `clojureLsp.refactor.cyclePrivacy` | ![](images/refactoring/cyclePrivacy.gif)
Inline Symbol | `clojureLsp.refactor.inlineSymbol` | ![](images/refactoring/inlineSymbol.gif)
Introduce let | `clojureLsp.refactor.introduceLet` | Creates a new let box with the binding. Follow up with ”Expand let” to move it upwards.<br>![](images/refactoring/introduceLet.gif)
Expand Let | `clojureLsp.refactor.expandLet` | ![](images/refactoring/expandLet.gif)
Move to Previous let Box | `clojureLsp.refactor.moveToLet` | ![](images/refactoring/moveToLet.gif)
Thread First | `clojureLsp.refactor.threadFirst` | ![](images/refactoring/threadFirst.gif)
Thread First All | `clojureLsp.refactor.threadFirstAll` | ![](images/refactoring/threadFirstAll.gif)
Thread Last | `clojureLsp.refactor.threadLast` | ![](images/refactoring/threadLast.gif)
Thread Last All | `clojureLsp.refactor.threadLastAll` | ![](images/refactoring/threadLastAll.gif)
Unwind All | `clojureLsp.refactor.unwindAll` | ![](images/refactoring/unwindAll.gif)
Unwind Thread | `clojureLsp.refactor.unwindThread` | ![](images/refactoring/unwindThread.gif)

!!! Note "Formatting"
    The way that some of the refactorings are applied to the document, makes it difficult for Calva to format the results. So, sometimes you'll need to navigate the cursor to the enclosing form and hit `tab` to tidy up the formatting after a refactoring. See also [Formatting](formatting.md).

## Thanks to clojure-lsp

Most of Calva's refactoring support is sourced directly from [clojure-lsp](clojure-lsp.md). This also means that most often, if you find issues with refactoring, or have suggestions about it, the clojure-lsp repo is where to direct your reporting.
