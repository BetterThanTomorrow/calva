# Emacs Keybindings
Some keybindings to make it easier for Emacs users
```json
[
    {
        "key": "ctrl+cmd+b",
        "command": "paredit.backwardSexp",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+alt+left",
        "command": "-paredit.backwardSexp",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "shift+cmd+]",
        "command": "-workbench.action.nextEditor"
    },
    {
        "key": "ctrl+shift+]",
        "command": "paredit.barfSexpBackward",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+shift+right",
        "command": "-paredit.barfSexpBackward",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+shift+[",
        "command": "paredit.barfSexpForward",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+left",
        "command": "-paredit.barfSexpForward",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+cmd+f",
        "command": "paredit.forwardSexp",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+alt+right",
        "command": "-paredit.forwardSexp",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+cmd+f",
        "command": "-workbench.action.toggleFullScreen"
    },
    {
        "key": "ctrl+shift+backspace",
        "command": "-paredit.killSexpForward",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "shift+cmd+k",
        "command": "-editor.action.deleteLines",
        "when": "textInputFocus && !editorReadonly"
    },
    {
        "key": "ctrl+shift+0",
        "command": "paredit.slurpSexpForward",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+right",
        "command": "-paredit.slurpSexpForward",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+shift+9",
        "command": "paredit.slurpSexpBackward",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+shift+left",
        "command": "-paredit.slurpSexpBackward",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+c ctrl+c",
        "command": "calva.evaluateCurrentTopLevelForm",
        "when": "calva:activated"
    },
    {
        "key": "ctrl+alt+c space",
        "command": "-calva.evaluateCurrentTopLevelForm",
        "when": "calva:activated"
    },
    {
        "key": "ctrl+x ctrl+e",
        "command": "calva.evalCurrentTopLevelFormInREPLWindow",
        "when": "calva:activated"
    },
    {
        "key": "ctrl+alt+c ctrl+alt+space",
        "command": "-calva.evalCurrentTopLevelFormInREPLWindow",
        "when": "calva:activated"
    },
    {
        "key": "ctrl+x ctrl+s",
        "command": "workbench.action.files.save"
    },
    {
        "key": "cmd+s",
        "command": "-workbench.action.files.save"
    },
    {
        "key": "cmd+s",
        "command": "paredit.spliceSexp",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+alt+s",
        "command": "-paredit.spliceSexp",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+cmd+k",
        "command": "paredit.cutForwardSexp",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+shift+x right",
        "command": "-paredit.cutForwardSexp",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+cmd+backspace",
        "command": "paredit.cutBackwardSexp",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+shift+x left",
        "command": "-paredit.cutBackwardSexp",
        "when": "calva:activated && calva:pareditValid && paredit:keyMap =~ /original|strict/"
    },
    {
        "key": "ctrl+1",
        "command": "-workbench.action.openEditorAtIndex1"
    },
    {
        "key": "ctrl+1",
        "command": "editor.action.quickFix",
        "when": "editorHasCodeActionsProvider && editorTextFocus && !editorReadonly"
    },
    {
        "key": "cmd+.",
        "command": "-editor.action.quickFix",
        "when": "editorHasCodeActionsProvider && editorTextFocus && !editorReadonly"
    },
    {
        "key": "cmd+.",
        "command": "editor.action.revealDefinition",
        "when": "editorHasDefinitionProvider && editorTextFocus && !isInEmbeddedEditor"
    },
    {
        "key": "f12",
        "command": "-editor.action.revealDefinition",
        "when": "editorHasDefinitionProvider && editorTextFocus && !isInEmbeddedEditor"
    }
]
```