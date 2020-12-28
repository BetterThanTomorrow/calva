# Finding Calva Commands

Calva relies a lot on that VS Code makes it really easy to find commands by opening the command palette: `ctrl+shift+p` (Windows/Linux), `cmd+shift+p` (Mac), and then start typing some words (or part of words) that you think might be in the command.

To leverage this, all Calva commands are prefixed with `Calva`. As an example, say you want to evaluate a form and pretty print it. Then you can do this:

1. Open the command palette
2. Type `calevpr`

VS Code will match `cal` to ”**Cal**va”, `ev` to ”**Ev**aluate”, and `pr` to ”**pr**etty” in ”**pr**etty print”. It looks like so:

<img src="https://user-images.githubusercontent.com/30010/59421711-5a0c1a00-8dcf-11e9-953d-64fe6c77598c.png" width=601px>

As you can see on the screenshot, VS Code will also reveal the keyboard shortcut for the command. My advice is to make it a habit to try to remember those shortcuts and use them for a more effective workflow.

Now might be a good time to see [Calva Top 10 Commands](commands-top10.md)

## All the Settings and Commands

Did you know? There is a complete list of Calva settings and commands in the *Contributions* tab of the Calva entry in the *Extensions* pane in VS Code.

![The Calva Contributions Tab](https://user-images.githubusercontent.com/30010/66733740-c754b800-ee60-11e9-877b-962f6b920cd7.png)

## Toggling Keyboard Shortcuts On/Off

The command `calva.toggleKeybindingsEnabled` can be used to quickly enable and disable (almost) all keyboard shortcuts. This allows you to quickly toggle between Calva keybindings and other keybindings which would otherwise not be available when Calva is enabled. This is particularly useful with the Paredit keyboard shortcuts, whose default shortcuts conflict with the default VS Code shortcuts for textual (non-structural) editing.

By default it is not bound to a shortcut so as not to cause confusion by users unwittingly pressing it, but if this is something you'd like to use often, you may want to bind it to a shortcut.
