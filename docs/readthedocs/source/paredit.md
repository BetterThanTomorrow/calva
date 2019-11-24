# Paredit

Structural editing and navigation for Clojure.

## What is it?

Paredit is a helper to edit your Clojure code in a structural way. LISP isn't line/character oriented, it is based around [S-expressions](https://en.wikipedia.org/wiki/S-expression), a.k.a forms. We strongly recommend that you take advantage of the structural nature of Clojure, by using Paredit.

If you are new to Paredit, start with learning the **Slurp Forward** (pull in the next form into this form) and **Barf Forward** (push the last form out of this form).

Also consider enabling the **strict mode** keybindings. It will help you keep the structure of the code, by ”refusing” to delete brackets that would unbalance things. When you want to delete something that strict mode hinders, use **Force backspace/delete**.

## Commands

Note: You can choose to disable all default key bindings by configuring `calva.paredit.defaultKeyMap` to `none`. (Then you probably also want to register your own shortcuts for the commands you often use.)

### Navigation

Default keybinding      | Action | Description
------------------      | ------ | -----------
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>right</kbd>          | **Forward Sexp/Form** | Moves the cursor forward, to the end of the current form. If at the end, moves to the end of the next form. Will not move out of lists.<br> ![](_static/images/paredit/forward-sexp.gif) 
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>left</kbd>           | **Backward Sexp/Form** | Moves the cursor backward, to the start of the current form. If at the start, moves to the start of the previous form. Will not move out of lists.<br> ![](_static/images/paredit/backward-sexp.gif)
<kbd>ctrl</kbd> <kbd>down</kbd>               | **Forward Down Sexp/Form** | Moves the cursor into the following list.<br> ![](_static/images/paredit/forward-down-sexp.gif)
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>up</kbd>             | **Backward Down Sexp/Form** | Moves the cursor into the preceding list.<br> ![](_static/images/paredit/backward-down-sexp.gif)
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>down</kbd>           | **Forward Up Sexp/Form** | Moves the cursor forwards, out of the current list.<br> ![](_static/images/paredit/forward-up-sexp.gif)
<kbd>ctrl</kbd> <kbd>up</kbd>                 | **Backward Up Sexp/Form** | Moves the cursor forwards, out of the current list.<br> ![](_static/images/paredit/backward-up-sexp.gif)
<kbd>ctrl</kbd> <kbd>end</kbd>                | **Forward to List End/Close** | Moves the cursor forwards, staying within the current list.<br> ![](_static/images/paredit/close-list.gif)
<kbd>ctrl</kbd> <kbd>home</kbd>               | **Backward to List Start/Open** | Moves the cursor backwards, staying within the current list.<br> ![](_static/images/paredit/open-list.gif) 

(Modify these with `shift` to select rather than move.)

### Selecting

Default keybinding    | Action | Description
------------------    | ------ | -----------
<kbd>ctrl</kbd> <kbd>w</kbd>                | **Expand Selection** | Starts from the cursor and selects the current form. Then will keep expanding to enclosing forms.<br> ![](_static/images/paredit/grow-selection.gif)
<kbd>ctrl</kbd> <kbd>shift</kbd> <kbd>w</kbd>          | **Shrink Selection** | Contracts back from an expanded selection.<br> ![](_static/images/paredit/shrink-selection.gif)
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>w</kbd>, <kbd>space</kbd>      | **Select Current Top Level Form** | Top level in a structural sence. Typically where your `(def ...)`/`(defn ...)` type forms. Please note that `(comment ...)` forms create a new top level.<br> ![](_static/images/paredit/select-top-level-form.gif) 


The selecting ”versions” of the navigation commands above:

Default keybinding    | Action | Description
------------------    | ------ | --------------
<kbd>ctrl</kbd> <kbd>shift</kbd> <kbd>alt</kbd> <kbd>right</kbd>  | **Select Forward Sexp/Form** | ![](_static/images/paredit/select-forward-sexp.gif) 
<kbd>ctrl</kbd> <kbd>shift</kbd> <kbd>alt</kbd> <kbd>left</kbd>   | **Select Backward Sexp/Form** | ![](_static/images/paredit/select-backward-sexp.gif)
<kbd>ctrl</kbd> <kbd>shift</kbd> <kbd>down</kbd>       | **Select Forward Down Sexp/Form** | ![](_static/images/paredit/select-forward-down-sexp.gif) <br>(You probably do not need to select like this, but you can!)
<kbd>ctrl</kbd> <kbd>shift</kbd> <kbd>alt</kbd> <kbd>up</kbd>     | **Select Backward Down Sexp/Form** | ![](_static/images/paredit/select-backward-down-sexp.gif) <br>(You probably do not need to select like this, but you can!)
<kbd>ctrl</kbd> <kbd>shift</kbd> <kbd>alt</kbd> <kbd>down</kbd>   | **Select Forward Up Sexp/Form** | ![](_static/images/paredit/select-forward-up-sexp.gif) <br>(You probably do not need to select like this, but you can!)
<kbd>ctrl</kbd> <kbd>shift</kbd> <kbd>up</kbd>         | **Select Backward Up Sexp/Form** | ![](_static/images/paredit/select-backward-up-sexp.gif) <br>(You probably do not need to select like this, but you can!)
<kbd>ctrl</kbd> <kbd>shift</kbd> <kbd>end</kbd>        | **Select Forward to List End/Close** | ![](_static/images/paredit/select-close-list.gif)
<kbd>ctrl</kbd> <kbd>shift</kbd> <kbd>home</kbd>       | **Select Backward to List Start/Open** | ![](_static/images/paredit/select-open-list.gif)

### Editing

Default keybinding                | Action | Description
------------------                | ------ | -----------
<kbd>ctrl</kbd> <kbd>right</kbd>                        | **Slurp Forward** |  Moves the _closing_ bracket _forward_, _away_ from the cursor, past the following form, if any. <br> ![](_static/images/paredit/slurp-forward.gif)
<kbd>ctrl</kbd> <kbd>left</kbd>                         | **Barf Forward** | Moves the _closing_ bracket _backward_, _towards_ the cursor, past the preceding form. <br> ![](_static/images/paredit/barf-forward.gif)
<kbd>ctrl</kbd> <kbd>shift</kbd> <kbd>left</kbd>                   | **Slurp Backward** | Moves the _opening_ bracket _backward_, _away_ from the cursor, past the preceding form, if any. <br> ![](_static/images/paredit/slurp-backward.gif)
<kbd>ctrl</kbd> <kbd>shift</kbd> <kbd>right</kbd>                  | **Barf Backward** | Moves the _opening_ bracket _forward_, _towards_ the cursor, past the following form. <br> ![](_static/images/paredit/barf-backward.gif)
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>s</kbd>, <kbd>s</kbd>                      | **Splice Current Form** | Remove enclosing brackets. <br> ![](_static/images/paredit/splice.gif)
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>shift</kbd> <kbd>s</kbd>                  | **Split Current List** | Splits into two lists of the same type as the current. <br> ![](_static/images/paredit/split.gif)
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>r</kbd>                        | **Raise Current Form** | Replaces the enclosing list with the current form. <br> ![](_static/images/paredit/raise.gif)
<kbd>ctrl</kbd> <kbd>shift</kbd> <kbd>c</kbd>                      | **Convolute** | ¯\\\_(ツ)_/¯ <br> ![](_static/images/paredit/convolute.gif)
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>delete</kbd>                   | **Kill/Delete One Sexp/Form Forward** |  <br> ![](_static/images/paredit/kill-forward-sexp.gif)
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>backspace</kbd>                | **Kill/Delete One Sexp/Form Backward** | <br> ![](_static/images/paredit/kill-backward-sexp.gif)
<kbd>ctrl</kbd> <kbd>delete</kbd>                       | **Kill/Delete Forward to End of List** | <br> ![](_static/images/paredit/kill-close-list.gif)
<kbd>ctrl</kbd> <kbd>backspace</kbd>                    | **Kill/Delete Backward to Start of List** | <br> ![](_static/images/paredit/kill-open-list.gif) 
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>s</kbd>, <kbd>delete</kbd>                 | **Splice Killing Forward** | Delete forward to end of the list, then Splice. <br> ![](_static/images/paredit/splice-killing-forward.gif)
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>s</kbd>, <kbd>backspace</kbd>              | **Splice Killing Backwards** | Delete backward to the start of the list, then Splice. <br> ![](_static/images/paredit/splice-killing-backward.gif) 
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>(</kbd>                        | **Wrap Around ()** | Wraps the current form, or selection, with parens. <br> ![](_static/images/paredit/wrap-around-parens.gif)
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>[</kbd>                        | **Wrap Around []** | Wraps the current form, or selection, with hard brackets. <br> ![](_static/images/paredit/wrap-around-brackets.gif)
<kbd>ctrl</kbd> <kbd>alt</kbd> <kbd>{</kbd>                        | **Wrap Around {}** | Wraps the current form, or selection, with curlies. <br> ![](_static/images/paredit/wrap-around-curlies.gif)

There is also a **strict** mode:

Strict mode keybinding              | Action | Description
----------------------              | ------ | -----------
<kbd>backspace</kbd>                | **Delete Backward** | Deletes one character backwards, unless it will unbalance a form. Otherwise moves past the character instead of deleting it. <br> ![](_static/images/paredit/strict-backspace.gif)
<kbd>delete</kbd>                   | **Delete Forward** | Deletes one character forwards, unless it will unbalance a form. Otherwise moves past the character instead of deleting it. <br> ![](_static/images/paredit/strict-delete.gif) This is currently not working 😢.
<kbd>alt</kbd> <kbd>backspace</kbd> | **Force Delete Backward** | Deletes one character backwards, even if it will unbalance a form. <br> ![](_static/images/paredit/force-backspace.gif)
<kbd>alt</kbd> <kbd>delete</kbd>    | **Force Delete Forward** | Deletes one character forwards, even if it will unbalance a form. <br> ![](_static/images/paredit/force-delete.gif)

NB: **Strict mode is disabled by default.** If you enable it, the backspace and delete keys won't let you remove parentheses or brackets so they become unbalanced. To force a delete anyway, use the supplied commands for that. Strict mode can be switched on by by configuring `calva.paredit.defaultKeyMap` to `strict`.
