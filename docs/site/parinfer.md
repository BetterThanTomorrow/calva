---
title: Parinfer
description: Yes, you can use Calva with with the Parinfer extension
---

# Using Calva with Parinfer

Yes, you can use Calva with with the Parinfer extension. The only conflict here is that Calva's auto-formatting (that which happens as you type) is going to risk clash with Parinfer's.

However, Calva's [Paredit](paredit.md) is carefully crafted. We suggest you consider that Clojure is a LISP, and therefore structural. There is power in this structure that other languages can not let you wield. Take advantage of this and make Paredit your friend. It takes only some few minutes to learn two or three basic Paredit commands:

* **Select form**
* **Slurp**
* **Barf**

Besides letting you benefit from auto-formatting, working this way will quickly bring you in better contact with the structural nature of the Clojure code. You'll thank yourself later.

Also, if you find yourself having deleted or added a bracket out of structure, despite Calva Paredit's **Strict mode** (which you are using, right?) there is a command that might help you heal the structure: **Infer Parens from Indentation**. That command is actually implemented using the Parinfer library, so it will let you recover from quite many situations. This command is bound to `shift+tab` by default, making it a good companion to `tab` which indents based on bracket structure. 

All that said, what was said first is true: if you want to use the Parinfer extension, you can. You'll probably want to disable Calva's auto-formatting. The setting for controlling this is named `calva.fmt.formatAsYouType`.