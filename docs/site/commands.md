---
title: Calva Commands
description: A list of all (well, not by far yet) Calva commands. A part of Calva's API.
---

# Calva Commands

!!! Note "This list is totally incomplete"
    If you want to help the Calva project, one way to do so is to help making this list of commands complete.

Calva's commands are part of the [Calva API](api.md). They often accept arguments of some type, which you can use from keybindings and from [Joyride](https://github.com/BetterThanTomorrow/joyride) (or another VS Code extension). Well behaved commands return a Promise, if it is async. You can utilize this with Joyride too, or with keybindings involving [`runCommands`](https://blog.agical.se/en/posts/vs-code-runcommands-for-multi-commands-keyboard-shortcuts/).

## Example shortcut bindings

To illustrate how to provide arguments to the Calva commands, here's a keyboard shortcut binding for `calva.refresh`:

```json
  {
    "key": "ctrl+alt+c f1",
    "command": "calva.refresh",
    "args": {
      "after": "component.repl/reset"
    }
  },
```

It sends along the `:after` argument for the `cider-nrepl/refresh` op. (The actual argument only makes sense with [Component](https://github.com/stuartsierra/component))

Here's another way to achieve something similar.

```json
  {
    "key": "ctrl+alt+c f1",
    "command": "runCommands",
    "args": {
      "commands": [
        "calva.refresh",
        {
          "command": "calva.runCustomREPLCommand",
          "args": "(component.repl/reset)"
        }
      ]
    }
  }
```

## REPL commands

Commands that establishes or needs a REPL connection.

| Command | Title | Arguments | Notes |
| :------ | :---- | :-------- | :---- |
| `calva.refresh` | Refreshes changed namespaces | A JSON object with stuff from [cider-nrepl ops/refresh](https://github.com/clojure-emacs/cider-nrepl/blob/master/doc/modules/ROOT/pages/nrepl-api/ops.adoc#refresh) | Mostly meant for sending `:dirs`, `:after`, and `:before`. The print options may or may not work.
| `calva.refreshAll` | Refreshes changed namespaces | A JSON object with stuff from [cider-nrepl ops/refresh-aa](https://github.com/clojure-emacs/cider-nrepl/blob/master/doc/modules/ROOT/pages/nrepl-api/ops.adoc#refresh-all) | Mostly meant for sending `:dirs`, `:after`, and `:before`. The print options may or may not work.


## Wait, where are all the commands?

Told you the list is incomplete... Please consider helping with making this a complete list! 🙏