---
title: VIM
description: Calva and the VIM Extension
---

# Calva and the VIM Extension

First thing first. The [VIM Extension](https://github.com/VSCodeVim/Vim) and Calva has a history of friction between them. Less so these days, but you might still encounter some rough edges. Please don't hesitate to reach out to the Calva team, as we might be able to fix things if only we are aware of them.

## Key bindings

In general Calva's default key bindings are not very VI-ish.

### Expand selection on Mac

On Mac, Calva binds **expand selection** to `ctrl+w`. This conflicts with the VIM Extension's default mapping of window splitting shortcuts. You'll need to remap it either with Calva or with the VIM Extension.

### The `esc` key

While showing inline evaluation results, Calva binds the `esc` key to dismiss the display of inline results. If you want to be able to use the `esc` key to enter command mode while inline results are showing, you'll need to rebind Calva's command for dismissing the inline results.

#### Remap Calva's `clearInlineResults`

- Open the Keyboard Shortcuts JSON file from the Command Palette
- Disable `clearInlineResults` and remap the command e.g.

```json
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
  }
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

### Backspace in Vim search

Calva's Paredit binds `backspace` with a `when` clause that can intercept the key even when the Vim search input is active. This causes backspace to edit the file instead of deleting characters in the search box.

To fix this, add `&& vim.mode == 'Insert'` to the `when` clause of Calva's backspace binding in your `keybindings.json`:

```json
{
  "key": "backspace",
  "command": "paredit.backwardSexp",
  "when": "calva:keybindingsEnabled && editorTextFocus && !calva:cursorInComment && !editorHasMultipleSelections && !editorReadOnly && editorLangId == 'clojure' && paredit:keyMap == 'strict' && vim.mode == 'Insert'"
}
```

### Vim Fireplace-ish keybindings

You can add these keybindings to your `init.vim` if you are using the VSCode Neovim extension. It is inspired by and tries to emulate the keybindings found in [vim-fireplace](https://github.com/tpope/vim-fireplace) which is the most popular vim plugin for Clojure.

```
nmap cqp :call VSCodeNotify('calva.jackIn')<CR>
nmap cqq :call VSCodeNotify('calva.disconnect')<CR>
nmap cpr :call VSCodeNotify('calva.loadFile')<CR>
nmap cpR :call VSCodeNotify('calva.loadNamespace')<CR>
nmap cpp :call VSCodeNotify('calva.evaluateSelection')<CR>
nmap cqc :call VSCodeNotify('calva.evalCurrentFormInREPLWindow')<CR>
```

Unfortunately these key combinations will not work in the normal VIM extension as `c` is an [operator key](https://github.com/VSCodeVim/Vim/issues/4464) and cannot be remapped. **This is a call for someone to share their VIM re-mappings**.
