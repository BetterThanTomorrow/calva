# Calva and the VIM Extension

First thing first. The [VIM Extension](https://github.com/VSCodeVim/Vim) and Calva has some friction between them. The alternative [VSCode Neovim](https://github.com/asvetliakov/vscode-neovim) extension may fare a bit better as it unbinds keystrokes from VS Code while not in insert mode and uses Neovim as a backend.

## Selection commands

Calva's various structural selection commands [do not put VIM into VISUAL mode](https://github.com/BetterThanTomorrow/calva/issues/297). This is true for many [VS Code selection scenarios](https://github.com/VSCodeVim/Vim/issues/2224) too, so it is not really Calva's fault, but it will be problematic for VIM Extension Calva users, regardless.

## Key bindings

In general Calva's default key bindings are not very VI-ish.

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

### Expand selection

Calva binds **expand selection** to `ctrl+w`. This conflicts with the VIM Extension's default mapping of window splitting shortcuts. You'll need to remap it either with Calva or with the VIM Extension.

### The `esc` key

Calva binds the `esc` key to dismiss the display of inline results. This gets into conflict with any `vi` coding since `esc` then is used to go back to command mode. You can either change Calva's default keybinding or the VIM extension's.

Alternatively, you can use the native Vim command `Ctrl + [` to escape and get back to command mode. Rebinding your keyboard's CapsLock key to Control may make this even easier.

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
