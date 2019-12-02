# Paredit – a Visual Guide

Structural editing and navigation for Clojure.

## What is Paredit?

Calva Paredit helps you navigate, select and edit Clojure code in a structural way. LISP isn't line or character oriented, it is based around [S-expressions](https://en.wikipedia.org/wiki/S-expression), a.k.a forms. We strongly recommend that you take advantage of the structural nature of Clojure, and have therefore put a lot of work into making Calva Paredit extra awesome.

If you are new to Paredit, start with learning the **Slurp Forward** (pull in the next form into this form) and **Barf Forward** (push the last form out of this form).

## Strict Mode

To protect the integrity of your code, **Strict mode** is enabled by default.

Strict mode keybinding              | Action | Description
----------------------              | ------ | -----------
 `backspace`                | **Delete Backward** | Deletes one character backwards, unless it will unbalance a form. Otherwise moves past the character instead of deleting it. If the list is empty, it will remove both open and close brackets. <br> ![](_static/images/paredit/strict-backspace.gif)
 `delete`                   | **Delete Forward** | Deletes one character forwards, unless it will unbalance a form. Otherwise moves past the character instead of deleting it. If the list is empty, it is removed. <br> ![](_static/images/paredit/strict-delete.gif)
 `alt+backspace` | **Force Delete Backward** | Deletes one character backwards, even if it will unbalance a form. <br> ![](_static/images/paredit/force-backspace.gif)
 `alt+delete`    | **Force Delete Forward** | Deletes one character forwards, even if it will unbalance a form. <br> ![](_static/images/paredit/force-delete.gif)

_Disable at your own peril._ Strict mode can be toggled on/off using the **Toggle Paredit Mode** command, and there is a status bar indicator telling you: 

Indicator | Paredit Mode
:-------: | ------
`[λ]`     | Strict
`(λ)`     | Cave Man
 `λ`      | No default key bindings

Toggle bewteen Strict and Cave Man using: `ctrl+alt+p ctrl+alt+m`

## Commands

The Paredit commands sorts into **Navigation**, **Selection**, and **Edit**. As mentioned, **Slurp** and **Barf** are power commands, which go into the editing category. Learning to navigate structurally, using shortcuts, also saves time and adds precision to your editing. It has the double effect that you at the same time learn how to select structurally, because that is the same, just adding the shift key.

To make the command descriptions a bit clearer, each entry is also animated. When you try to figure out what is going on in the GIFs, focus on where the cursor is at the start of the animation loop.

### Strings are not Lists, but Anyway...

In Calva Paredit, strings are treated in much the same way as lists are. Here's an example showing **Slurp** and **Barf**, **Forward/Backward List**, and **Grow Selection**.

![Stings are treated much like lists](_static/images/paredit/string-as-list.gif) 

### Navigating

(Modify these with`shift` to select rather than move, see below.)

Default keybinding      | Action | Description
------------------      | ------ | -----------
 `ctrl+alt+right`          | **Forward Sexp** | Moves the cursor forward, to the end of the current form. If at the end, moves to the end of the next form. Will not move out of lists.<br> ![](_static/images/paredit/forward-sexp.gif) 
 `ctrl+alt+left`           | **Backward Sexp** | Moves the cursor backward, to the start of the current form. If at the start, moves to the start of the previous form. Will not move out of lists.<br> ![](_static/images/paredit/backward-sexp.gif)
 `ctrl+down`               | **Forward Down Sexp** | Moves the cursor into the following list.<br> ![](_static/images/paredit/forward-down-sexp.gif)
 `ctrl+alt+up`             | **Backward Down Sexp** | Moves the cursor into the preceding list.<br> ![](_static/images/paredit/backward-down-sexp.gif)
 `ctrl+alt+down`           | **Forward Up Sexp** | Moves the cursor forwards, out of the current list.<br> ![](_static/images/paredit/forward-up-sexp.gif)
 `ctrl+up`                 | **Backward Up Sexp** | Moves the cursor backwards, out of the current list.<br> ![](_static/images/paredit/backward-up-sexp.gif)
 `ctrl+end`                | **Forward to List End/Close** | Moves the cursor forwards, staying within the current list.<br> ![](_static/images/paredit/close-list.gif)
 `ctrl+home`               | **Backward to List Start/Open** | Moves the cursor backwards, staying within the current list.<br> ![](_static/images/paredit/open-list.gif) 

### Selecting

Default keybinding    | Action | Description
------------------    | ------ | -----------
 `ctrl+w`                | **Expand Selection** | Starts from the cursor and selects the current form. Then will keep expanding to enclosing forms.<br> ![](_static/images/paredit/grow-selection.gif)
 `ctrl+shift+w`          | **Shrink Selection** | Contracts back from an expanded selection performed by any Paredit selection command.<br> ![](_static/images/paredit/shrink-selection.gif)<br>(In the animation the selection is first grown using a combination of **Grow Selection** and some lateral selection commands, then shrunk all the way back down to no selection.)
 `ctrl+alt+w space`      | **Select Top Level Form** | Top level in a structural sence. Typically where your`(def ...)`/`(defn ...)` type forms. Please note that`(comment ...)` forms create a new top level. <br> ![](_static/images/paredit/select-top-level-form.gif) 


The selecting ”versions” of the navigation commands above. They will all grow whatever current selection as far as the **Shrink Selection** command is concerned.

Default keybinding    | Action | Description
------------------    | ------ | --------------
 `ctrl+shift+alt+right`  | **Select Forward Sexp** | ![](_static/images/paredit/select-forward-sexp.gif) 
 `ctrl+shift+alt+left`   | **Select Backward Sexp** | ![](_static/images/paredit/select-backward-sexp.gif)
 `ctrl+shift+down`       | **Select Forward Down Sexp** | ![](_static/images/paredit/select-forward-down-sexp.gif) <br>(You probably do not need to select like this, but you can!)
 `ctrl+shift+alt+up`     | **Select Backward Down Sexp** | ![](_static/images/paredit/select-backward-down-sexp.gif) <br>(You probably do not need to select like this, but you can!)
 `ctrl+shift+alt+down`   | **Select Forward Up Sexp** | ![](_static/images/paredit/select-forward-up-sexp.gif) <br>(You probably do not need to select like this, but you can!)
 `ctrl+shift+up`         | **Select Backward Up Sexp** | ![](_static/images/paredit/select-backward-up-sexp.gif) <br>(You probably do not need to select like this, but you can!)
 `ctrl+shift+end`        | **Select Forward to List End/Close** | ![](_static/images/paredit/select-close-list.gif)
 `ctrl+shift+home`       | **Select Backward to List Start/Open** | ![](_static/images/paredit/select-open-list.gif)

(Earlier versions of Calva had commands for copying, cutting and deleting that corresponded to all movements. This has now been replaced with this selection commands, and you can choose to copy/cut/delete once you have the selection.)

### Editing

Default keybinding                | Action | Description
------------------                | ------ | -----------
 `ctrl+right`                        | **Slurp Forward** |  Moves the _closing_ bracket _forward_, _away_ from the cursor, past the following form, if any. <br> ![](_static/images/paredit/slurp-forward.gif)
 `ctrl+left`                         | **Barf Forward** | Moves the _closing_ bracket _backward_, _towards_ the cursor, past the preceding form. <br> ![](_static/images/paredit/barf-forward.gif)
 `ctrl+shift+left`                   | **Slurp Backward** | Moves the _opening_ bracket _backward_, _away_ from the cursor, past the preceding form, if any. <br> ![](_static/images/paredit/slurp-backward.gif)
 `ctrl+shift+right`                  | **Barf Backward** | Moves the _opening_ bracket _forward_, _towards_ the cursor, past the following form. <br> ![](_static/images/paredit/barf-backward.gif)
 `ctrl+alt+s`                      | **Splice Sexp** | Remove enclosing brackets. <br> ![](_static/images/paredit/splice.gif)
 `ctrl+shift+s`                  | **Split Sexp** | Splits a string, or a list, into two strings, or lists of the same type as the current. <br> ![](_static/images/paredit/split.gif)
 `ctrl+shift+j`                  | **Join Sexps/Forms** | Joins two strings, or two lists of the same type, into one form (string/list). <br> ![](_static/images/paredit/join.gif)
 `ctrl+alt+p ctrl+alt+r`                        | **Raise Sexp** | Replaces the enclosing list with the current form. <br> ![](_static/images/paredit/raise.gif)
 `ctrl+alt+t`                        | **Transpose Sexps/Forms** | Swaps place of the two forms surrounding the cursor. <br> ![](_static/images/paredit/transpose.gif)
 `ctrl+alt+shift`  `l`<br> `ctrl+alt+shift`  `r` | **Push Sexp Left/Right** | Moves the current form to the left/right of the previous/next one. <br> ![](_static/images/paredit/left-right.gif)
 `ctrl+shift+c`                      | **Convolute** | ¯\\\_(ツ)_/¯ <br> ![](_static/images/paredit/convolute.gif)
 `ctrl+shift+delete`                   | **Kill Sexp Forward** | Deletes the next form in the same enclosing form as the cursor.<br> ![](_static/images/paredit/kill-forward-sexp.gif)
 `ctrl+alt+backspace`                | **Kill Sexp Backward** | Deletes the previous form in the same enclosing form as the cursor.<br> ![](_static/images/paredit/kill-backward-sexp.gif)
 `ctrl+delete`                       | **Kill List Forward** | Deletes everything from the cursor to the closing of the current enclosing form.<br> ![](_static/images/paredit/kill-close-list.gif)
 `ctrl+backspace`                    | **Kill List Backward** | Deletes everything from the cursor to the opening of the current enclosing form.<br> ![](_static/images/paredit/kill-open-list.gif) 
 `ctrl+alt+shift+delete`                 | **Splice Killing Forward** | Delete forward to end of the list, then Splice. <br> ![](_static/images/paredit/splice-killing-forward.gif)
 `ctrl+alt+shift+backspace`              | **Splice Killing Backwards** | Delete backward to the start of the list, then Splice. <br> ![](_static/images/paredit/splice-killing-backward.gif) 
 `ctrl+alt+shift+p`                        | **Wrap Around ()** | Wraps the current form, or selection, with parens. <br> ![](_static/images/paredit/wrap-around-parens.gif)
 `ctrl+alt+shift+s`                        | **Wrap Around []** | Wraps the current form, or selection, with square brackets. <br> ![](_static/images/paredit/wrap-around-brackets.gif)
 `ctrl+alt+shift+c`                        | **Wrap Around {}** | Wraps the current form, or selection, with curlies. <br> ![](_static/images/paredit/wrap-around-curlies.gif)
 `ctrl+alt+shift+q`                        | **Wrap Around ""** | Wraps the current form, or selection, with double quotes. Inside strings it will quote the quotes. <br> ![](_static/images/paredit/wrap-around-quotes.gif)
 `ctrl+alt+r`<br>`ctrl+alt+p`/`s`/`c`/`q`                        | **Rewrap** | Changes enclosing brackets of the current form to parens/square brackets/curlies/double quotes.. <br> ![](_static/images/paredit/rewrap.gif)


## About the Keyboard Shortcuts

Care has been put in to making the default keybindings somewhat logical, easy to use, and work with most keyboard layouts. Slurp and barf forward are extra accessible to go with the recommendation to learn using these two super handy editing commands.

Note: You can choose to disable all default key bindings by configuring `calva.paredit.defaultKeyMap` to `none`. (Then you probably also want to register your own shortcuts for the commands you often use.)

If you add your own key bindings, please be aware that [shortcuts with typable characters will work badly in the the REPL window](https://github.com/microsoft/vscode/issues/85879). Please avoid.

Happy Editing! ❤️