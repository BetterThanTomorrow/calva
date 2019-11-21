# Paredit

Structural editing and navigation for Clojure.

## What is it?

Paredit is a helper to edit your Clojure code in a structural way. LISP isn't line oriented, it is oriented around sexpressions: forms enclosed in some types of brackets. We strongly recommend you use it.

If you are new to Paredit, start with learning the **Slurp Forward** (pull in the next form into this sexpression) and **Barf Forward** (push the last form out of this sexpression).

Also consider enabling the **strict mode** keybindings. It will help you keep the structure of the code, by ”refusing” to delete brackets that would unbalance things. When you want to delete something that strict mode hinders, use `alt+backspace`.

## Commands

Note: You can choose to disable all default key bindings by configuring `calva.paredit.defaultKeyMap` to `none`. (Then you probably also want to register your own shortcuts for the commands you often use.)

### Navigation

Default keybinding      | Action
------------------      | ------
ctrl+alt+right          | Forward Sexp
ctrl+alt+left           | Backward Sexp
ctrl+down               | Forward Down Sexp
ctrl+alt+up             | Backward Down Sexp
ctrl+alt+down           | Forward Up Sexp
ctrl+up                 | Backward Up Sexp
ctrl+end                | Forward to List End/Close
ctrl+home               | Backward to List Start/Open

### Selecting

Default keybinding | Action
------------------ | ------
ctrl+w             | Expand Selection
ctrl+shift+w       | Shrink Selection
ctrl+alt+w space   | Select Current Top Level Form

### Editing

Default keybinding                | Action
------------------                | ------
ctrl+right                        | Slurp Forward
ctrl+shift+left                   | Slurp Backward
ctrl+left                         | Barf Forward
ctrl+shift+right                  | Barf Backward
ctrl+alt+s s                      | Splice
ctrl+alt+shift+s                  | Split Sexp
ctrl+alt+r                        | Raise Sexp
ctrl+alt+t                        | Transpose
ctrl+shift+c                      | Convolute ¯\\\_(ツ)_/¯
ctrl+alt+delete                   | Kill Sexp Forward
ctrl+alt+backspace                | Kill Sexp Backward
ctrl+delete                       | Kill Forward to End of List
ctrl+backspace                    | Kill Backward to Start of List
ctrl+alt+s delete                 | Splice & Kill Forward
ctrl+alt+s backspace              | Splice & Kill Backward
ctrl+alt+(                        | Wrap Around ()
ctrl+alt+[                        | Wrap Around []
ctrl+alt+{                        | Wrap Around {}

Strict mode keybinding            | Action
----------------------            | ------
backspace                         | Delete Backward, unless it will unbalance a form
delete                            | Delete Forward, unless it will unbalance a form
alt+backspace                     | Force Delete Backward
alt+delete                        | Force Delete Forward

NB: **Strict mode is disabled by default.** If you enable it, the backspace and delete keys won't let you remove parentheses or brackets so they become unbalanced. To force a delete anyway, use the supplied commands for that. Strict mode can be switched on by by configuring `calva.paredit.defaultKeyMap` to `strict`.
