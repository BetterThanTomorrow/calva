---
title: Static Calva
description: How to use Calva with other REPL clients
---

# Use Calva w/o the REPL

Why would anyone want to use a Clojure editor without a REPL? It could be because you prefer some other REPL client over [Calva's ditto](https://calva.io/try-first/), like [Clover](https://github.com/mauricioszabo/clover/), but would be lacking Calva's [clojure-lsp](https://clojure-lsp.github.io/clojure-lsp/) support, [formatter](formatting.md), [Paredit](paredit.md), [highlighter](highlight), etcetera.

As it could be a bit confusing and cluttered to have several REPL UIs active at the same time, Calva supports this use with a setting to disable most of its REPL UI elements, like statusbar items, command palette entries and editor context menus.

* Set `calva.hideReplUi` to `true` and the only commands still visible should be those for Connect and Jack-in.

If you have the Calva REPL UI disabled and still want to [connect or jack-in to a REPL using Calva](connect.md), just do it. Then Calva's REPL UI will wake up and be there for the duration of the session.

## Consider uninstalling these extensions

Without Calva, many users install other nifty extensions (some of which are old pieces of Calva) that help with this or that problem. It might sometimes work together with Calva, sometimes not. Here's a list of some common extensions you should consider to at least disable:

* Strict Paredit - Calva Paredit has evolved a lot since that version
* Calva-fmt/Calva Formatter - Same here, evolution
* Clojure Warrior - Calva includes it, in a much evolved way
* Parinfer - This one you _can_ actually keep, _at some cost_, see [Using Calva with Parinfer](parinfer.md).

## There's only one Calva REPL, though

Of course we encourage you to use Calva's REPL. It gives you easy ways to

* [start a Clojure REPL](connect.md)
* [connect to an running REPL](connect.md#connecting-wo-jack-in)
* [super duper nice debugger](debugger.md)
* [test runner](test-runner.md)
* [custom REPL commands](custom-commands.md)
* enhanced symbol lookup and code navigation (keep navigating into library and Clojure core code, as well as into Java code).
* easy to use [output](output.md) with [pretty printing](pprint.md), on-demand [stack traces](output.md#stack-traces), and that awesome [debugger.md](debugger.md)

Happy REPLing, whichever REPL client you choose. ❤️