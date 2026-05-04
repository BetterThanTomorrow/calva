## Design Context

### Users

VS Code developers adopting or practicing Clojure/ClojureScript. The audience spans from **complete Clojure beginners** (the explicit growth mission) to **experienced Clojurians** who chose VS Code as their editor. They arrive with VS Code muscle memory and expectations — syntax highlighting, command palette, familiar keybindings — and need the REPL to feel like a natural extension of that, not a foreign system bolted on.

The context of use is deep-focus programming: long sessions, high cognitive load, frequent context-switching between code and REPL output. The interface must never compete for attention with the code itself.

### Brand Personality

**Approachable, precise, alive.**

Calva is named after Calvados — a spirit that gains its character from what it's distilled from (CIDER/nREPL) and what it matures in (VS Code). The brand voice is that of a master distiller: confident but unhurried, opinionated but welcoming, spartan but *not* poor. As the Tao states: "VS Code and Clojure brought together has the capacity to create something amazingly rich and luxurious."

The emotional goals are **confidence** (I know what's happening), **flow** (nothing breaks my concentration), and **precision** (sharp, exact, professional). The anti-reference is GitLens — invasive, attention-grabbing, too much visual presence in the editor.

### Aesthetic Direction

- **Theme**: Native VS Code. Custom surfaces (webviews, output panels) should feel like they belong to the user's chosen VS Code theme, not to Calva's own visual system. Use `var(--vscode-*)` CSS custom properties as the primary palette.
- **Brand color**: Golden amber `#db9550` — core brand accent. Use sparingly: status indicators, the Calva logo, moments of identity. Never as a dominant surface color.
- **Font**: Fira Code is the bundled code font for webviews. Body/UI text inherits from VS Code's editor font family.
- **Tone**: Quiet competence. The interface should feel like a well-made tool — present when needed, invisible when not. Spartan in the Halloway sense: few features, each done right.
- **Anti-patterns**: Invasive decorations, unsolicited overlays, attention-competing UI, feature clutter. Calva should never make the user aware of Calva when they're trying to think about Clojure.

### Design Principles

1. **The VS Code way is Calva's way.** Leverage existing VS Code patterns and conventions. What's old is old; what's new should be as easy as possible to pick up. Don't invent new interaction patterns when VS Code already has one.

2. **Remove obstacles to the REPL.** Every UI decision should be evaluated by: does this help or hinder the developer's path to evaluating code and understanding results? The REPL connection is the critical moment; evaluation results are the critical data.

3. **Spartan, not poor.** Resist feature creep. Few knobs, sane defaults. But the knobs that exist should feel luxurious — well-considered, well-placed, well-documented. Quality over quantity.

4. **Simplify the complex.** Calva has organic complexity (multiple output destinations, REPL window maintenance, session routing). Design should actively work to reduce cognitive load around these areas rather than expose the underlying complexity.

5. **Invisible when working, present when needed.** Status information, connection state, session routing — these should be discoverable but not intrusive. The developer's attention belongs to their code, not to Calva's UI.
