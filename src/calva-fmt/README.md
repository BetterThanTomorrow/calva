# Calva Format

A Clojure and ClojureScript formatter for Visual Studio Code.

## Raison d´être

1. To the extent possible, formatting should happen as you type. Code should very seldom be in a an unformatted state.
1. **Fewer dependencies, less headaches**. You should be able to edit a Clojure file, with full formatting help, without depending on a REPL running or anything else needed to be installed.
1. **Fewer conflicts, more predictability**. As VSCode gets to be a more serious editor for Clojurians there is a an editing war going on between the various plugins that help with editing Clojure code. Calva Formatter is aiming at being the major Clojure formatter, lifting this responsibility from the shoulders of extensions like Calva, Paredit and other Clojure related extensions.

## Features

* Formats according to the community [Clojure Style Guide](https://github.com/bbatsov/clojure-style-guide) (while giving you some options to tweak this style).
* Formats the code when new lines are entered, mostly keeping things formated as you type.
* Adds a command for formatting the enclosing form, default key binding is `tab`.
* Adds a command for aligning map items, and bindings in the current form, default key binding `ctrl+alt+l`. (This is a bit experimental and will not always produce the prettiest results. Also it is recursive.) You can also opt-in to have this behaviour be on for all formatting, via settings.
* Adds a command for infering parens/brackets from indents (using ParinferLib), default key binding `ctrl+alt+f ctrl+alt+p`.
* Adds a command for indenting and dedenting the current line (using ParinferLib), default key binding `ctrl+i` and `shift+ctrl+i`, respectively.
* Provides the formater for the VSCode *Format Selection* and *Format Document* commands as well as for *Format on Paste*.
* Is intended to be used alongside and by other Clojure extensions.

### Demo GIF time

Some examples of what it can be like to use Calva Formatter:

### Format Current Form

![Format Current Form](/src/calva-fmt/assets/format-current-form.gif)

### Align Current Form

![Align Current Form](/src/calva-fmt/assets/align-items.gif)

### Parinfer

![Infer parens](/src/calva-fmt/assets/parinfer.gif)

## How to use

Install it and edit away. It will keep the code formatted mostly as you type, in a somewhat ”relaxed” way, and will format it more strictly (collecting trailing brackets, for instance) when you hit `tab`. Search the settings for `calva-fmt` to see how you can tweak it.


## You might not need to install it

*Calva Formatter* comes bundled with [Calva](https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.calva)

## Written in ClojureScript

Built with [Shadow CLJS](http://shadow-cljs.org/).

## By the Calva team a.k.a. Better Than Tomorrow

We are committed to make the Clojure experience in VS Code productive and pleasurable.

* [Peter Strömberg](https://github.com/PEZ)
* [Matt Seddon](https://github.com/mseddon)
* You?


## Something is not working?

File issues or send pull requests. You can also find us in the #editors and #calva channels of Clojurians Slack.


## Disable the Parinfer Extension

Calva Formatter and the current Parinfer extension are not compatible. Some Parinfer functionality is is built in, though, in the form of explicit commands, see above feature list.

## Calva Paredit recommended

[Calva Paredit](https://marketplace.visualstudio.com/items?itemName=cospaia.paredit-revived) brings great structural editing support to VS Code.

## How to contribute

Calva Formater is written in TypeScript and ClojureScript. It is setup so that the formatting ”decisions” are made by a library written in ClojureScript and then TypeScript is used to integrate these decisions into VS Code. Division of labour.

See [How to Contribute](https://github.com/BetterThanTomorrow/calva-fmt/wiki/How-to-Contribute) on the project wiki for instructions.

## The Future of calva-fmt

* Make it honor project settings.
* Offer more pretty printing options.

## Happy Formatting ❤️


PRs welcome, file an issue or chat us up in the [`#calva` channel](https://clojurians.slack.com/messages/calva/) of the Clojurians Slack. Tweeting [@pappapez](https://twitter.com/pappapez) works too.

[![#calva in Clojurians Slack](https://img.shields.io/badge/clojurians-calva--dev-blue.svg?logo=slack)](https://clojurians.slack.com/messages/calva/)
