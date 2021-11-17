---
title: Paredit, a Visual Guide
description: Learn how to leverage Clojure and ClojureScript structural editing, navigation, and selection
search:
  boost: 7
---

# Paredit – a Visual Guide

Structural editing and navigation for Clojure. Works great together with [Parinfer](parinfer.md).

## What is Paredit?

Calva Paredit helps you navigate, select and edit Clojure code in a structural way. LISP isn't line or character oriented, it is based around [S-expressions](https://en.wikipedia.org/wiki/S-expression), a.k.a forms. We strongly recommend that you take advantage of the structural nature of Clojure, and have therefore put a lot of work into making Calva Paredit extra awesome.

If you are new to Paredit, consider starting with learning the **Slurp Forward** (pull in the next form into this form) and **Barf Forward** (push the last form out of this form). It will take you quite far.

## Strict Mode

To protect the integrity of your code, **Strict mode** is enabled by default.

Strict mode keybinding              | Action | Description
----------------------              | ------ | -----------
 `backspace`                | **Delete Backward** | Deletes one character backwards, unless it will unbalance a form. Otherwise moves past the character instead of deleting it. If the list is empty, it will remove both open and close brackets. <br> ![](images/paredit/strict-backspace.gif)
 `delete`                   | **Delete Forward** | Deletes one character forwards, unless it will unbalance a form. Otherwise moves past the character instead of deleting it. If the list is empty, it is removed. <br> ![](images/paredit/strict-delete.gif)
 `alt+backspace` | **Force Delete Backward** | Deletes one character backwards, even if it will unbalance a form. <br> ![](images/paredit/force-backspace.gif)
 `alt+delete`    | **Force Delete Forward** | Deletes one character forwards, even if it will unbalance a form. <br> ![](images/paredit/force-delete.gif)

_Disable at your own peril._ Strict mode can be toggled on/off using the **Toggle Paredit Mode** command, and there is a status bar indicator telling you:

Indicator | Paredit Mode
:-------: | ------
`[λ]`     | Strict
`(λ)`     | Cave Man (strict mode off)
 `λ`      | No default key bindings

Strict mode also inserts matching brackets when you type an open bracket.

Toggle between Strict and Cave Man using: `ctrl+alt+p ctrl+alt+m`

!!! Note "Parinfer is strict mode"
    When you are using Calva's [Parinfer](parinfer.md) mode, then this strictness is handled by Parinfer. It is recommended that you leave this setting on regardless.

## Commands

The Paredit commands are sorted into **Navigation**, **Selection**, and **Edit**. As mentioned, **Slurp** and **Barf** are power commands, which go into the editing category. Learning to navigate structurally, using shortcuts, also saves time and adds precision to your editing. It has the double effect that you at the same time learn how to select structurally, because that is the same, just adding the shift key.

To make the command descriptions a bit clearer, each entry is animated. When you try to figure out what is going on in the GIFs, focus on where the cursor is at the start of the animation loop.

### Strings are not Lists, but Anyway...

In Calva Paredit, strings are treated in much the same way as lists are. Here's an example showing **Slurp** and **Barf**, **Forward/Backward List**, and **Grow Selection**.

![](images/paredit/string-as-list.gif)

### Navigating

(Modify these with `shift` to select rather than move, see below.)

Default keybinding      | Action | Description
------------------      | ------ | -----------
 `ctrl+right` (win/linux)<br>`alt+right` (mac)          | **Forward Sexp** | Moves the cursor forward, to the end of the current form. If at the end, moves to the end of the next form. Will not move out of lists.<br> ![](images/paredit/forward-sexp.gif)
 `ctrl+left` (win/linux)<br>`alt+left` (mac)          | **Backward Sexp** | Moves the cursor backward, to the start of the current form. If at the start, moves to the start of the previous form. Will not move out of lists.<br> ![](images/paredit/backward-sexp.gif)
 `ctrl+down`               | **Forward Down Sexp** | Moves the cursor into the following list.<br> ![](images/paredit/forward-down-sexp.gif)
 `ctrl+alt+up`             | **Backward Down Sexp** | Moves the cursor into the preceding list.<br> ![](images/paredit/backward-down-sexp.gif)
 `ctrl+alt+down`           | **Forward Up Sexp** | Moves the cursor forwards, out of the current list.<br> ![](images/paredit/forward-up-sexp.gif)
 `ctrl+up`                 | **Backward Up Sexp** | Moves the cursor backwards, out of the current list.<br> ![](images/paredit/backward-up-sexp.gif)
 `ctrl+end`                | **Forward to List End/Close** | Moves the cursor forwards, staying within the current list.<br> ![](images/paredit/close-list.gif)
 `ctrl+home`               | **Backward to List Start/Open** | Moves the cursor backwards, staying within the current list.<br> ![](images/paredit/open-list.gif)

### Selecting

Most of these commands are selecting ”versions” of the navigation commands above. Repeated use will grow the current selection step by step.

Default keybinding    | Action | Description
------------------    | ------ | -----------
 `shift+alt+right` (win/linux)<br>`ctrl+w` (mac)                | **Expand Selection** | Starts from the cursor and selects the current form. Then will keep expanding to enclosing forms.<br> ![](images/paredit/grow-selection.gif)
 `shift+alt+left` (win/linux)<br>`ctrl+shift+w` (mac)         | **Shrink Selection** | Contracts back from an expanded selection performed by any Paredit selection command.<br> ![](images/paredit/shrink-selection.gif)<br>(In the animation the selection is first grown using a combination of **Grow Selection** and some lateral selection commands, then shrunk all the way back down to no selection.)
 `ctrl+alt+w space`      | **Select Top Level Form** | Top level in a structural sence. Typically where your`(def ...)`/`(defn ...)` type forms. Please note that`(comment ...)` forms create a new top level. <br> ![](images/paredit/select-top-level-form.gif)
 `shift+ctrl+right` (win/linux)<br>`shift+alt+right` (mac)  | **Select Forward Sexp** | ![](images/paredit/select-forward-sexp.gif)
  `ctrl+shift+k`         | **Select Right**          | Select forward to the end of the current form or the first newline. See **Kill right** below. (The animation also shows **Shrink Selection**).<br> ![](images/paredit/select-right.gif)
 `shift+ctrl+left` (win/linux)<br>`shift+alt+left`(mac)   | **Select Backward Sexp** | ![](images/paredit/select-backward-sexp.gif)
 `ctrl+shift+down`       | **Select Forward Down Sexp** | ![](images/paredit/select-forward-down-sexp.gif) <br>(You probably do not need to select like this, but you can!)
 `ctrl+shift+alt+up`     | **Select Backward Down Sexp** | ![](images/paredit/select-backward-down-sexp.gif) <br>(You probably do not need to select like this, but you can!)
 `ctrl+shift+alt+down`   | **Select Forward Up Sexp** | ![](images/paredit/select-forward-up-sexp.gif) <br>(You probably do not need to select like this, but you can!)
 `ctrl+shift+up`         | **Select Backward Up Sexp** | ![](images/paredit/select-backward-up-sexp.gif) <br>(You probably do not need to select like this, but you can!)
 `ctrl+shift+end`        | **Select Forward to List End/Close** | ![](images/paredit/select-close-list.gif)
 `ctrl+shift+home`       | **Select Backward to List Start/Open** | ![](images/paredit/select-open-list.gif)

### Editing

Default keybinding                | Action | Description
------------------                | ------ | -----------
 `ctrl+alt+right` (mac/win)<br>`ctrl+alt+.` (linux)                       | **Slurp Forward** |  Moves the _closing_ bracket _forward_, _away_ from the cursor, past the following form, if any. <br> ![](images/paredit/slurp-forward.gif)
 `ctrl+alt+left` (mac/win)<br>`ctrl+alt+,` (linux)                       | **Barf Forward** | Moves the _closing_ bracket _backward_, _towards_ the cursor, past the preceding form. <br> ![](images/paredit/barf-forward.gif)
 `ctrl+alt+shift+left`                   | **Slurp Backward** | Moves the _opening_ bracket _backward_, _away_ from the cursor, past the preceding form, if any. <br> ![](images/paredit/slurp-backward.gif)
 `ctrl+alt+shift+right`                  | **Barf Backward** | Moves the _opening_ bracket _forward_, _towards_ the cursor, past the following form. <br> ![](images/paredit/barf-backward.gif)
 `ctrl+alt+s`                      | **Splice Sexp** | Remove enclosing brackets. <br> ![](images/paredit/splice.gif)
 `ctrl+shift+s`                  | **Split Sexp** | Splits a string, or a list, into two strings, or lists of the same type as the current. <br> ![](images/paredit/split.gif)
 `ctrl+shift+j`                  | **Join Sexps/Forms** | Joins two strings, or two lists of the same type, into one form (string/list). <br> ![](images/paredit/join.gif)
 `ctrl+alt+p ctrl+alt+r`                        | **Raise Sexp** | Replaces the enclosing list with the current form. <br> ![](images/paredit/raise.gif)
 `ctrl+alt+t`                        | **Transpose Sexps/Forms** | Swaps place of the two forms surrounding the cursor. <br> ![](images/paredit/transpose.gif)
 `alt+up`<br>`alt+down` | **Drag Sexp Backward/Forward** | Moves the current form to the behind/in front of the previous/next one. (See below about behavior in maps and binding boxes.) <br> ![](images/paredit/drag-backward-forward.gif)
 `ctrl+alt+shift` `u`<br>`ctrl+alt+shift` `d` | **Drag Sexp Backward Up**<br>**Drag Sexp Forward Down** | Moves the current form up/out of the current list, *backwards*, and down/in to the following list, *forwards*, keeping the cursor within the sexpr being dragged.<br> ![](images/paredit/drag-backward-up-forward-down.gif)
 `ctrl+alt+shift` `k`<br>`ctrl+alt+shift` `j` | **Drag Sexp Forward Up**<br>**Drag Sexp Backward Down** | Moves the current form up/out of the current list, *forwards*, and down/in to the preceding list, *backwards*, keeping the cursor within the sexpr being dragged.<br> ![](images/paredit/drag-forward-up-backward-down.gif)
 `ctrl+shift+c`                      | **Convolute** | ¯\\\_(ツ)_/¯ <br> ![](images/paredit/convolute.gif)
 `ctrl+shift+delete`                   | **Kill Sexp Forward** | Deletes the next form in the same enclosing form as the cursor.<br> ![](images/paredit/kill-forward-sexp.gif)
 `ctrl+k`                            | **Kill Right**          | Delete forward to the end of the current form or the first newline.<br> ![](images/paredit/kill-right.gif)
 `ctrl+alt+backspace`                | **Kill Sexp Backward** | Deletes the previous form in the same enclosing form as the cursor.<br> ![](images/paredit/kill-backward-sexp.gif)
 `ctrl+delete`                       | **Kill List Forward** | Deletes everything from the cursor to the closing of the current enclosing form.<br> ![](images/paredit/kill-close-list.gif)
 `ctrl+backspace`                    | **Kill List Backward** | Deletes everything from the cursor to the opening of the current enclosing form.<br> ![](images/paredit/kill-open-list.gif)
 `ctrl+alt+shift+delete`                 | **Splice Killing Forward** | Delete forward to end of the list, then Splice. <br> ![](images/paredit/splice-killing-forward.gif)
 `ctrl+alt+shift+backspace`              | **Splice Killing Backwards** | Delete backward to the start of the list, then Splice. <br> ![](images/paredit/splice-killing-backward.gif)
 `ctrl+alt+shift+p`                        | **Wrap Around ()** | Wraps the current form, or selection, with parens. <br> ![](images/paredit/wrap-around-parens.gif)
 `ctrl+alt+shift+s`                        | **Wrap Around []** | Wraps the current form, or selection, with square brackets. <br> ![](images/paredit/wrap-around-brackets.gif)
 `ctrl+alt+shift+c`                        | **Wrap Around {}** | Wraps the current form, or selection, with curlies. <br> ![](images/paredit/wrap-around-curlies.gif)
 `ctrl+alt+shift+q`                        | **Wrap Around ""** | Wraps the current form, or selection, with double quotes. Inside strings it will quote the quotes. <br> ![](images/paredit/wrap-around-quotes.gif)
 `ctrl+alt+r`<br>`ctrl+alt+p`/`s`/`c`/`q`                        | **Rewrap** | Changes enclosing brackets of the current form to parens/square brackets/curlies/double quotes.. <br> ![](images/paredit/rewrap.gif)

!!! Note "Copy to Clipboard when killing text"
    You can have the *kill* commands always copy the deleted code to the clipboard by setting `calva.paredit.killAlsoCutsToClipboard` to `true`.  If you want to do this more on-demand, you can kill text by using the [selection commands](#selecting) and then *Cut* once you have the selection.



### Drag bindings forward/backward

When dragging forms inside maps and binding boxes, such as with `let`, `for`, `binding`, etcetera, it often makes most sense to drag each binding as a pair. And this is what Calva will do. Like so:

![](images/paredit/drag-pairs-in-binding-box.gif)

And like so (wait for it):

![](images/paredit/drag-pairs-in-maps.gif)

## About the Keyboard Shortcuts

Care has been put in to making the default keybindings somewhat logical, easy to use, and work with most keyboard layouts. Slurp and barf forward are extra accessible to go with the recommendation to learn using these two super handy editing commands.

You can choose to disable all default key bindings by configuring `calva.paredit.defaultKeyMap` to `none`. (Then you probably also want to register your own shortcuts for the commands you often use.)

You can relax how Paredit's shortcuts replace VS Code built in shortcuts a bit by setting `calva.paredit.hijackVSCodeDefaults` to `false`.

There are some context keys you can utilize to configure keyboard shortcuts with precision. See [Customizing Keyboard Shortcuts](customizing.md#when-clause-contexts).

*The Nuclear Option*: You can choose to disable all default key bindings by configuring `calva.paredit.defaultKeyMap` to `none`. (Then you probably also want to register your own shortcuts for the commands you often use.)

In some instances built-in command defaults are the same as Paredit's defaults, and Paredit's functionality in a particular case is less than what the default is. This is true of *Expand Selection* and *Shrink Selection* for Windows/Linux when multiple lines are selected. In this particular case adding `!editorHasMultipleSelections` to the `when` clause of the binding makes for a better workflow. The point is that when the bindings overlap and default functionality is desired peaceful integration can be achieved with the right `when` clause. This is left out of Paredit's defaults to respect user preference, and ease of maintenance.

## See also

* [Parinfer](parinfer.md)
* [Formatting](formatting.md)

## Cheering-ons

Happy Editing! ❤️
