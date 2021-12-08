---
title: Parinfer
description: Learn how to leverage Calva Parinfer Mode for structural editing 
---

# Calva Parinfer Mode

!!! Note "Reverted in Calva v2.0.228"
    The changes in v2.0.227 seemed to cause problems for some users. Unclear yet if and why. But to not risk causing problems for more users these changes where reverted and Calva v2.0.228 does not contain them. **Please consider using v2.0.227 and help find what the problems are about!**

[Parinfer](https://shaunlebron.github.io/parinfer/) is a system for editing the structure of LISP text without explicit commands. The structure can be regarded as already being expressed through indentation. With Parinfer you can use your intuition about the structure _inferred_ from the indentation to perform surprisingly many structural edits.

!!! Note "Experimental"
    This feature is currently disabled by default and should be considered experimental. There are known [quirks](#quirks). Especially beginners should take note. Parinfer is not as beginner friendly as it might seem, and with the quirks it might be extra ”dangerous”.

## Infer Parens

When you enable Calva's Parinfer it is all about infering brackets from indentation. There are no further Parinfer modes. Calva's auto-formatter will take care of keeping the code correctly indented.

Enable it with from this setting: `calva.fmt.experimental.inferParensAsYouType` or from the status bar item.

### Parinfer Status bar items

To the right on the status bar, right before the [Paredit](paredit.md) status bar item, you will have two items, Parinfer toggle ON/OFF and a health indicator.

1. Parinfer **ON**/**OFF** indicator/button. <kbd>•()</kbd> (The dot/circle indicates **ON**/**OFF**)
2. Structure and indentation health indicator. <kbd>✔️</kbd>/<kbd>⚠</kbd>/<kbd>⊘</kbd>

When Parinfer is **ON**, the health indicator will have three states:

1. <kbd>✔️</kbd> Healthy - meaning both structure and indentation is OK
2. <kbd>⊘</kbd> Structure broken - you need to fix the the structure of the code
3. <kbd>⚠</kbd> Bad indentation - meaning that to Parinfer the structure and indentation do not match, _the item is now also a button with which you can fix the indentation.

Parinfer will be disabled in both the unhealthy states.

When Parinfer is OFF, only the first two states above are used.

## Some VS Code Settings automatically changed

In order for some automatic VS Code behaviour not to interfere with Parinfer the following settings are automatically configured when you toggle Parinfer ON:

```json
    "[clojure]": {
        "editor.autoClosingBrackets": "never",
        "editor.autoClosingOvertype": "never",
        "editor.formatOnPaste": false
    },
```

And when you toggle Parinfer OFF:

```json
    "[clojure]": {
        "editor.autoClosingBrackets": "always",
        "editor.autoClosingOvertype": "always",
        "editor.formatOnPaste": true
    },
```

It is recommended that you let Calva handle these settings to avoid weird behaviour.

## No Tab indenting

As the `tab` key is used for formatting the current form in Calva, it is ”taken”. The closest equivalents you have are `space` and `backspace`. At least for now. We'll see if we can find out a good way for supporting `tab` and `shift+tab` for indent and dedent.

`tab` for formatting is of course just a default key binding and you can assign it to something else to get it to do indenting. However, it will not be a very smart indent anyway, there is no Clojure awareness about it. You are hereby adviced to instead use some more spaces.

## Paredit is still there

In Calva, Parinfer and [Paredit](paredit.md) are designed to coexist and both be there to let you edit the structure easily and efficiently. Since Paredit commands are always formatted, they leave the code in a state where Parinfer has what it needs to infer bracket placement as you either edit the indentation, or remove/add brackets.

## Disable the Parinfer Extension

If you want to have Parinfer you are probably best served by Calva's built-in version. It is designed, and will continue to be improved to function well together with Calva's other structural editing and formatting features. _It will also probably conflict with the Parinfer Extension._

## Quirks

There are some known quirks, of varying severity, with this feature. Some of them will need to be fixed before we move this feature out of **Experimental** status.

For the most times you can always *Undo* to get back to where the document was fine. You just need to pay some attention and be aware when undo is needed.

### No multi-cursor support

The bracket inference will remove all cursors but the first one. So for instance if you edit with multiple cursors and it causes brackets to move, you'll end up with just one cursor and the subsequent edits will not be what you intended. This is particularly important to note when you have cursors that are not in the viewport. In such cases it might be better to turn Parinfer off while you do the edits, fix formatting and such manually and then switch Parinfer on again.

### Wrong inferences

For yet unknown reasons an edit such as the following does the wrong thing (the cursor indicated by the vertical bar):

```clojure
(foo| (bar)
      (baz))
```

<kbd>backspace</kbd> => 

```clojure
(fo| (bar
      (baz)))
```

That is `(baz)` is slurped. When what should happen is:

```clojure
(fo| (bar)
     (baz))
```

### Lag causing errors when fast typing

The way that Calva Parinfer works is that for any edit of the document it first reformats the code around the cursor, then infer brackets. Currently these two steps are not atomic to VS Code, so if you type fast bracket inference might happen on the yet unformatted code, and thus not be correct. You might also see the cursor end up at the wrong position at times.

## See also

* [Paredit](paredit.md)
* [Formatting](formatting.md)