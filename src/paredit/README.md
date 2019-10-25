# Paredit

Structural editing and navigation for Clojure.

## What is it?

Paredit is a helper to edit your Clojure code in a structural way. LISP isn't line oriented, it is oriented around sexpressions: forms enclosed in some types of brackets. We strongly recommend you use it.

If you are new to Paredit, start with learning the **Slurp Forward** (pull in the next form into this sexpression) and **Barf Forward** (push the last form out of this sexpression).

Also consider enabling the **strict mode** keybindings. It will help you keep the structure of the code, by ”refusing” to delete brackets that would unbalance things. When you want to delete something that strict mode hinders, use `alt+backspace`.

## Commands

Note: You can choose to disable all default key bindings by configuring `calva.paredit.defaultKeyMap` to `none`. (Then you probably also want to register your own shortcuts for the commands you often use.)

### Navigation

Default keybinding | Action
------------------ | ------
ctrl+alt+right     | Forward Sexp
ctrl+cmd+right (on Mac) | Forward Sexp
ctrl+alt+left      | Backward Sexp
ctrl+cmd+left  (on Mac) | Backward Sexp
ctrl+down          | Forward Down Sexp
ctrl+up            | Backward Up Sexp
ctrl+alt+shift+right    | Close List

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
ctrl+alt+s                        | Splice
ctrl+alt+shift+s                  | Split Sexp
ctrl+delete                       | Kill Sexp Forward
ctrl+shift+backspace (on Mac)     | Kill Sexp Forward
ctrl+backspace                    | Kill Sexp Backward
ctrl+alt+down                     | Splice & Kill Forward
ctrl+alt+up                       | Splice & Kill Backward
ctrl+alt+(                        | Wrap Around ()
ctrl+alt+[                        | Wrap Around []
ctrl+alt+{                        | Wrap Around {}
ctrl+alt+i                        | Indent
---                               | Transpose

Strict mode keybinding            | Action
----------------------            | ------
backspace                         | Delete Backward, unless it will unbalance a form
delete                            | Delete Forward, unless it will unbalance a form
shift+backspace (on Mac)          | Delete Forward, unless it will unbalance a form
ctrl+alt+backspace                | Force Delete Backward
ctrl+alt+delete                   | Force Delete Forward
alt+shift+backspace (on Mac)      | Force Delete Forward

NB: **Strict mode is disabled by default.** If you enable it, the backspace and delete keys won't let you remove parentheses or brackets so they become unbalanced. To force a delete anyway, use the supplied commands for that. Strict mode can be switched on by by configuring `calva.paredit.defaultKeyMap` to `strict`.


### Copying/Yanking

Default keybinding | Action
------------------ | ------
ctrl+alt+c ctrl+right         | Copy Forward Sexp
ctrl+alt+c ctrl+left          | Copy Backward Sexp
ctrl+alt+c ctrl+down          | Copy Forward Down Sexp
ctrl+alt+c ctrl+up            | Copy Backward Up Sexp
ctrl+alt+c ctrl+alt+right     | Copy Close List

### Cutting

Default keybinding | Action
------------------ | ------
ctrl+alt+x ctrl+right         | Cut Forward Sexp
ctrl+alt+x ctrl+left          | Cut Backward Sexp
ctrl+alt+x ctrl+down          | Cut Forward Down Sexp
ctrl+alt+x ctrl+up            | Cut Backward Up Sexp
ctrl+alt+x ctrl+alt+right     | Cut Close List

