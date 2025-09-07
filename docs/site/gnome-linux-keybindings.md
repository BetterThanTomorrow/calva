

---
title: Gnome Linux Keybindings
description: Some keybindings to make it easier for Gnome Linux users
---

# Gnome/Linux Keybindings
This guide provides custom keybindings for Calva in VS Code, making its paredit features more familiar to users of Gnome on Linux. These changes align Calva's shortcuts with common Gnome editing and window management conventions.

## Summary of Changes

* **Delete S-Expressions**: Aligns with Gnome's word deletion shortcuts.  Ctrl+Backspace now deletes an sexp backward and Ctrl+Delete deletes an sexp forward. This is similar to deleting word in Gnome's text editors.

* **Beginning & End Movement**: Aligns with Gnome's line navigation shortcuts.  Home moves the cursor to the beginning of a list and End moves to the end of the list.  Control+Home and Control+End revert to their defaults, moving the cursor to the beginning and end of the document.

* **Select S-Expressions**: Aligns with Gnome's line selection shortcuts.  Shift+Home selects backward to the start of an expression, just like Shift+Home selects to the beginning of a line in Gnome. Shift+End does the same for the end of an expression.

* **Transpose**: Changes the shortcut to avoid conflicts with Gnome's terminal shortcut.  Calva's default Ctrl+Alt+T conflicts with Gnome's shortcut for opening a new terminal window.  The new shortcut is Ctrl+Alt+Shift+T.

* **Slurp & Barf**: Modifies the shortcuts to avoid conflicts with Gnome's workspace management.  The default Ctrl+Shift+Alt+Left / Right conflicts with Gnome's shortcuts for moving windows between workspaces.  The new shortcuts are Ctrl+Alt+H (for barf backward) and Ctrl+Alt+L (for slurp backward). This follows the H (left) and L (right) vi conventions.


Tested on Ubuntu 24.04.3.

Add the JSON below to your VS Code keybindings.json file.
```json
[
    // kill word backward on most Linux UIs is ctrl+backspace, forward is ctrl+delete
    // so remap those bindings from killListBackward and killListForward.
    {
        "key": "ctrl+alt+backspace",
        "command": "-paredit.killSexpBackward",
        "when": "calva:keybindingsEnabled && editorTextFocus && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+backspace",
        "command": "paredit.killSexpBackward",
        "when": "calva:keybindingsEnabled && editorTextFocus && !calva:cursorInWhitespaceAfterComment && !calva:cursorInComment && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+shift+delete",
        "command": "-paredit.killSexpForward",
        "when": "calva:keybindingsEnabled && editorTextFocus && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+delete",
        "command": "paredit.killSexpForward",
        "when": "calva:keybindingsEnabled && editorTextFocus && !calva:cursorInComment && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+backspace",
        "command": "-paredit.killListBackward",
        "when": "calva:keybindingsEnabled && editorTextFocus && !calva:cursorInComment && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+delete",
        "command": "-paredit.killListForward",
        "when": "calva:keybindingsEnabled && editorTextFocus && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },

    // selecting to beginning of line is Shift+Home, end of line is Shift+End
    {
        "key": "ctrl+shift+home",
        "command": "-paredit.selectOpenList",
        "when": "calva:keybindingsEnabled && editorTextFocus && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "shift+home",
        "command": "paredit.selectOpenList",
        "when": "calva:keybindingsEnabled && editorTextFocus && !calva:cursorInComment && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+shift+end",
        "command": "-paredit.selectCloseList",
        "when": "calva:keybindingsEnabled && editorTextFocus && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "shift+end",
        "command": "paredit.selectCloseList",
        "when": "calva:keybindingsEnabled && editorTextFocus && !calva:cursorInComment && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+alt+t",
        "command": "-paredit.transpose",
        "when": "calva:keybindingsEnabled && editorTextFocus && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },


    // in Gnome, Control+Alt+T brings up a new terminal window

    {
        "key": "ctrl+shift+alt+t",
        "command": "paredit.transpose",
        "when": "calva:keybindingsEnabled && editorTextFocus && !calva:cursorInComment && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },

    
    // in Gnome, ctrl+shift+alt+right, ctrl+shift+alt+left moves the workspace
    {
        "key": "ctrl+shift+alt+right",
        "command": "-paredit.barfSexpBackward",
        "when": "calva:keybindingsEnabled && editorTextFocus && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+alt+l",
        "command": "paredit.barfSexpBackward",
        "when": "calva:keybindingsEnabled && editorTextFocus && !calva:cursorInComment && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },

    {
        "key": "ctrl+shift+alt+left",
        "command": "-paredit.slurpSexpBackward",
        "when": "calva:keybindingsEnabled && editorTextFocus && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+alt+h",
        "command": "paredit.slurpSexpBackward",
        "when": "calva:keybindingsEnabled && editorTextFocus && !calva:cursorInComment && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },

    // home and end keys go to beginning and end of the current list, ctrl+home and ctrl+end go to beginning and end of file
    {
        "key": "home",
        "command": "paredit.openList",
        "when": "calva:keybindingsEnabled && editorTextFocus && !calva:cursorInComment && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+home",
        "command": "-paredit.openList",
        "when": "calva:keybindingsEnabled && editorTextFocus && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "end",
        "command": "paredit.closeList",
        "when": "calva:keybindingsEnabled && editorTextFocus && !calva:cursorInComment && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+end",
        "command": "-paredit.closeList",
        "when": "calva:keybindingsEnabled && editorTextFocus && editorLangId == 'clojure' && paredit:keyMap =~ /original|strict/"
    }

]
```

# Other known keybinding collisions

There are other keybinding collisions.  I have rebound those
keys to use the keypad, but that requires a 101 key keyboard.  You may wish to change them to be a corded binding.

If you wish to rebind them, the other keybinding collisions that I have found are:

* ctrl+alt+up is already bound to move workspace up
```
      {
        "command": "paredit.backwardDownSexp",
        "key": "ctrl+alt+up",
        "when": "calva:keybindingsEnabled && editorLangId == clojure && editorTextFocus && paredit:keyMap =~ /original|strict/"
      },
```

* ctrl+alt+down is already bound to move workspace down
```
      {
        "command": "paredit.forwardUpSexp",
        "key": "ctrl+alt+down",
        "when": "calva:keybindingsEnabled && editorLangId == clojure && editorTextFocus && paredit:keyMap =~ /original|strict/"
      },
```

* ctrl+shift+alt+up is already bound to move to workspace up
```
      {
        "command": "paredit.selectBackwardDownSexp",
        "key": "ctrl+shift+alt+up",
        "when": "calva:keybindingsEnabled && editorLangId == clojure && editorTextFocus && paredit:keyMap =~ /original|strict/"
      },
```


* ctrl+shift+alt+down is already bound to move to workspace down
```
      {
        "command": "paredit.selectForwardUpSexp",
        "key": "ctrl+shift+alt+down",
        "when": "calva:keybindingsEnabled && editorLangId == clojure && editorTextFocus && paredit:keyMap =~ /original|strict/"
      },
```

* ctrl+shift+alt+u - this is already bound to unicode input mode 
```
      {
        "command": "paredit.dragSexprBackwardUp",
        "key": "ctrl+shift+alt+u",
        "when": "calva:keybindingsEnabled && editorLangId == clojure && editorTextFocus && paredit:keyMap =~ /original|strict/"
      },
```

