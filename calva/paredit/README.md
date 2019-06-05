# Calva Paredit

Structural editing and navigation for Clojure.

<p align="center">
<a href="https://marketplace.visualstudio.com/items?itemName=cospaia.paredit-revived"><img width="128px" height="128px" src="https://github.com/PEZ/paredit-for-vscode/raw/master/assets/paredit.png" title="Paredit icon"></img></a>
</p>

## Part of Calva

Calva Paredit is a part of [Calva](https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.calva), a Clojure and ClojureScript extension for bringing the REPL power into VS Code.

## Commands

Note: You can choose to disable all default key bindings by configuring `calva.paredit.defaultKeyMap` to `none`. (Then you probably also want to register your own shortcuts for the commands you often use.)

### Navigation

Default keybinding | Action
------------------ | ------
ctrl+right         | Forward Sexp
ctrl+left          | Backward Sexp
ctrl+down          | Forward Down Sexp
ctrl+up            | Backward Up Sexp
ctrl+alt+right     | Close List

### Selecting

Default keybinding | Action
------------------ | ------
ctrl+w             | Expand Selection
ctrl+shift+w       | Shrink Selection
ctrl+alt+w space   | Select Current Top Level Form

### Editing

Default keybinding                | Action
------------------                | ------
ctrl+alt+.                        | Slurp Forward
ctrl+alt+<                        | Slurp Backward
ctrl+alt+,                        | Barf Forward
ctrl+alt+>                        | Barf Backward
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

NB: **Strict mode is disabled by default.** If you ensable it, the backspace and delete keys won't let you remove parentheses or brackets so they become unbalanced. To force a delete anyway, use the supplied commands for that. Strict mode can be switched on by by configuring `calva.paredit.defaultKeyMap` to `strict`.


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

## Maintained by Better Than Tomorrow

* Peter Strömberg
* You?


I also published and maintain [Calva](https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.calva), another Visual Studio Code extension. Calva is aimed at making it super easy to get Clojure and Clojurescript coding done. It sports interactive REPLs, inline evaluation and other stuff people from the Emacs Cider world are used to.

## Happy Coding

PRs welcome, as are Issues. Or chat @pez or @mseddon up in the [`#calva-dev` channel](https://clojurians.slack.com/messages/calva-dev/) of the Clojurians Slack. Tweeting [@pappapez](https://twitter.com/pappapez) works too.

[![#calva-dev in Clojurians Slack](https://img.shields.io/badge/clojurians-calva--dev-blue.svg?logo=slack)](https://clojurians.slack.com/messages/calva-dev/)

❤️
