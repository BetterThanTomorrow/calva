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
ctrl+alt+right          | Forward Sexp/Form | Moves the cursor forward, to the end of the current form. If at the end, moves to the end of the next form. Will not move out of lists.
ctrl+alt+left           | Backward Sexp/Form | Moves the cursor backward, to the start of the current form. If at the start, moves to the start of the previous form. Will not move out of lists.
ctrl+down               | Forward Down Sexp/Form | Moves the cursor into the following list.
ctrl+alt+up             | Backward Down Sexp/Form  | Moves the cursor into the preceding list.
ctrl+alt+down           | Forward Up Sexp/Form | Moves the cursor backwards, out of the current list.
ctrl+up                 | Backward Up Sexp/Form | Moves the cursor forwards, out of the current list.
ctrl+end                | Forward to List End/Close | Moves the cursor forwards, staying within the current list.
ctrl+home               | Backward to List Start/Open | Moves the cursor backwards, staying within the current list.

(Modify these with `shift` to select rather than move.)

### Selecting

Default keybinding    | Action | Description
------------------    | ------ | -----------
ctrl+w                | Expand Selection | Starts from the cursor and selects the current form. Then will keep expanding to enclosing forms.
ctrl+shift+w          | Shrink Selection | Contracts back from an expanded selection.
ctrl+alt+w space      | Select Current Top Level Form | Top level forms are usually `(def ...)`/`(defn ...)` type forms. Try it, and you'll see.


The selecting ”versions” of the navigation commands above:
Default keybinding    | Action
------------------    | ------ 
ctrl+shift+alt+right  | Select Forward Sexp/Form
ctrl+shift+alt+left   | Select Backward Sexp/Form
ctrl+shift+down       | Select Forward Down Sexp/Form
ctrl+shift+alt+up     | Select Backward Down Sexp/Form
ctrl+shift+alt+down   | Select Forward Up Sexp/Form
ctrl+shift+up         | Select Backward Up Sexp/Form
ctrl+shift+end        | Select Forward to List End/Close
ctrl+shift+home       | Select Backward to List Start/Open

### Editing

Default keybinding                | Action                  | Description
------------------                | ------                  | -----------
ctrl+right                        | Slurp Forward |  Moves the _closing_ bracket _forward_, _away_ from the cursor, past the following form, if any.
ctrl+shift+left                   | Slurp Backward | Moves the _opening_ bracket _backward_, _away_ from the cursor, past the preceding form, if any.
ctrl+left                         | Barf Forward  | Moves the _closing_ bracket _backward_, _towards_ the cursor, past the preceding form
ctrl+shift+right                  | Barf Backward  | Moves the _opening_ bracket _forward_, _towards_ the cursor, past the following form.
ctrl+alt+s s                      | Splice Current Form | Remove enclosing brackets
ctrl+alt+shift+s                  | Split Current List | Splits into two lists of the same type as the current.
ctrl+alt+r                        | Raise Current Form | Replaces the enclosing list with the current form. 
ctrl+shift+c                      | Convolute | ¯\\\_(ツ)_/¯
ctrl+alt+delete                   | Kill/Delete One Form Forward
ctrl+alt+backspace                | Kill/Delete One Form Backward
ctrl+delete                       | Kill/Delete Forward to End of List
ctrl+backspace                    | Kill/Delete Backward to Start of List
ctrl+alt+s delete                 | Splice Killing Forward | Delete forward to end of the list, then Splice
ctrl+alt+s backspace              | Splice Killing Backwards | Delete backward to the start of the list, then Splice
ctrl+alt+(                        | Wrap Around () | Wraps the current form, or selection, with parens
ctrl+alt+[                        | Wrap Around [] | Wraps the current form, or selection, with hard brackets
ctrl+alt+{                        | Wrap Around {}| Wraps the current form, or selection, with curlies.

There is also a **strict** mode:

Strict mode keybinding            | Action | Description
----------------------            | ------ | -----------
backspace                         | Delete Backward | Unless it will unbalance a form
delete                            | Delete Forward  | Unless it will unbalance a form
alt+backspace                     | Force Delete Backward | Even if it will unbalance a form
alt+delete                        | Force Delete Forward | Even if it will unbalance a form

NB: **Strict mode is disabled by default.** If you enable it, the backspace and delete keys won't let you remove parentheses or brackets so they become unbalanced. To force a delete anyway, use the supplied commands for that. Strict mode can be switched on by by configuring `calva.paredit.defaultKeyMap` to `strict`.
