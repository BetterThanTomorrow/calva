# Quirks

Here's a shocker for ya': Calva isn't perfect. 😄

There are quirks and things that flat out do not work. We'll try to collect info about such things here, providing workarounds when available (or, rather, known to us).

## Strange linting errors?

The Joker way of linting is awesome, but has its limitations. If you think the linting reporting is off, it is probably something you should check with the [Joker project](https://github.com/candid82/joker).

That said, this one might be worth a mention here:

### Unrecognized macros
One thing to note with this linter is that it doesn't do a full scan of all files and does not recognize macros it doesn't know about. Leading to false complaints about `Unable to resolve symbol x`. You might now and then tell it about macros you use. Create a `.joker` file somewhere in the path from the root of your project to where you are using the macro (the project root might be the best choice), and add:
```clojure
{:known-macros [some-ns/some-macro some-other-ns/some-other-macro]}
```
Read more about Joker's linter mode here: https://github.com/candid82/joker#linter-mode

## Test features not available with ClojureScript

Currently [`cider-nrepl` does not provide its test functionality for ClojureScript](https://github.com/clojure-emacs/cider-nrepl/issues/555) code. Please consider contributing to fixing that.

## Using with Parinfer

Calva defaults to formatting as you type. If you use Parinfer this creates a conflict, since it auto-indents your code. If you want to use Parinfer you'll have to tell Calva not to do auto-formatting by disabling `calva.fmt.formatAsYouType`.

However, with VS Code and Calva it is probably better to learn to use [Paredit](paredit.md)'s **slurp** and **barf** and generally use Calva's automatic formatting.


## MacOS and the Slurp and Barf Keyboard Shortcuts

To make slurping and barfing forward really easy to perform they are bound to `ctrl+right` and `ctrl+left`, respectively. However on MacOS those shortcuts are sometimes bound by Mission Control, causing the Calva shortcuts to not work. One way to solve it is to disable the shortcuts in *System Preferences -> Keyboard -> Shortcuts*:

![Disable Mission Control Shortcuts](../../../assets/mission-control-shortcuts.gif)

## Calva and the VIM Extension

See [Using Calva with the VIM Extension](vim.md)