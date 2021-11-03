---
title: Parinfer
description: Yes, you can use Calva with with the Parinfer extension
---

# Using Calva with Parinfer

Yes, you can use Calva with with the Parinfer extension. The only conflict here is that Calva's auto-formatting (that which happens as you type) is going to risk clash with Parinfer's.

However, Calva's [Paredit](paredit.md) is carefully crafted. If you don't already have an established preference for parinfer, we suggest you give it a try. Even parinfer veterans may find they prefer the explicit nature of paredit. It takes only some few minutes to learn two or three basic Paredit commands:

* **Select form**
* **Slurp**
* **Barf**

Also, if you find yourself having deleted or added a bracket out of structure, despite Calva Paredit's **Strict mode** (which you are using, right?) there is a command that might help you heal the structure: **Infer Parens from Indentation**. That command is actually implemented using the Parinfer library, so it will let you recover from quite many situations. This command is bound to `shift+tab` by default, making it a good companion to `tab` which indents based on bracket structure. 

All that said, what was said first is true: if you want to use the Parinfer extension, you can. You'll probably want to disable Calva's auto-formatting. The setting for controlling this is named `calva.fmt.formatAsYouType`.
