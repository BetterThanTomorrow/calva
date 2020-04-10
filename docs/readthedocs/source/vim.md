# Calva and the VIM Extension

First thing first. The [VIM Extension](https://github.com/VSCodeVim/Vim) and Calva has some friction between them. Expect it to be a bit painful.

## Selection commands

Calva's various structural selection commands [do not put VIM into VISUAL mode](https://github.com/BetterThanTomorrow/calva/issues/297). This is true for many [VS Code selection scenarios](https://github.com/VSCodeVim/Vim/issues/2224) too, so it is not really Calva's fault, but it will be problematic for VIM Extension Calva users, regardless.

## Key bindings

In general Calva's default key bindings are not very VI-ish. **This is a call for someone to share their VIM re-mappings**.

### Expand selection

Calva binds **expand selection** to `ctrl+w`. This conflicts with the VIM Extension's default mapping of window splitting shortcuts. You'll need to remap it either with Calva or with the VIM Extension.

### The `esc` key

Calva binds the `esc` key to dismiss the display of inline results. This gets into conflict with any `vi` coding since `esc` then is used to go back to command mode. You can either fix Calva's default keybinding or the VIM extension.

Alternatively, you can use the native Vim command `Ctrl + [` to escape and get back to command mode. Rebinding your keyboard's CapsLock key to Control may make this even easier.

#### Remap Calva's `clearInlineResults`

- Open the Keyboard Shortcuts JSON file from the Command Palette
- Disable `clearInlineResults` and remap the command e.g.

```
// Place your key bindings in this file to override the defaults
[
  {
    "key": "escape",
    "command": "-calva.clearInlineResults"
  },
  {
    "key": "shift+escape",
    "command": "calva.clearInlineResults",
    "when": "editorTextFocus && !editorHasMultipleSelections && !editorReadOnly && !hasOtherSuggestions && !suggestWidgetVisible && editorLangId == 'clojure'"
  },
]
```

If you run into issues, refer to the commands in the default Keyboard Shortcuts JSON file.

#### Remap Vim's Insert Mode

Remap vim's insert mode keybinding to go into command mode by adding the following to your user settings:

```json
"vim.insertModeKeyBindings": [
    {
        "before": ["j", "k"],
        "after": ["<esc>"]
    }
]
```

(Change `before` to whatever keybinding you are comfortable with!)

## No Vim mode for the REPL Window

This is not likely to be fixed anytime soon. (Because, a **lot** of work.)

