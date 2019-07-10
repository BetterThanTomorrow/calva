# Clojure Warrior

<img src="https://raw.githubusercontent.com/tonsky/clojure-warrior/master/extras/icon.png" width="128px" height="128px">

Visual Studio Code extension for Clojure development

## Features

Rainbow brackets:

- Chooses bracket color based on nesting level
- Distinct bracket colors, plays well with [Alabaster theme](https://marketplace.visualstudio.com/items?itemName=tonsky.theme-alabaster)
- Properly handles strings, comments and escaped characters
- Highlights misplaced brackets

Bracket pair matching:

- Higlights corresponding bracket pair to the one under the cursor
- Considers bracket directon and cursor position relative to it
- Only highlights pair when cursor is standing _outside_ the expression (right after the closed bracket or right before opening one)

Jump to matching bracket commands:

- Jump to corresponding bracket pair (same rules as in bracket pair matching): `clojureWarrior.jumpToMatchingBracket`
- Select a region between cursor and matching bracket (including brackets): `clojureWarrior.selectToMatchingBracket`

![Screenshot](https://raw.githubusercontent.com/tonsky/clojure-warrior/master/extras/screenshot.png)

## Configuration

| Key | Meaning | Example |
| --- | ------- | ------- |
| `"clojureWarrior.enableBracketColors"` | Enable rainbow colors |  `true` |
| `"clojureWarrior.bracketColors"` | Which colors to use |  `["#000", "#999"]` |
| `"clojureWarrior.cycleBracketColors"` | Whether same colors should be reused for deeply nested brackets | `true` |
| `"clojureWarrior.misplacedBracketStyle"` | Style of misplaced bracket | `{ "border": "2px solid #c33" }` |
| `"clojureWarrior.matchedBracketStyle"` | Style of bracket pair highlight | `{"backgroundColor": "#E0E0E0"}` |
| `"clojureWarrior.commentFormStyle"` | Style of `(comment ...)` form | `{"textDecoration": "none; opacity: 0.5"}` |
| `"clojureWarrior.ignoredFormStyle"` | Style of `#_...` form | `{"textDecoration": "none; opacity: 0.5"}` |

To disable VS Code default bracket matching for Clojure files, add this to `settings.json`:

```
    "[clojure]": {
        "editor.matchBrackets": false
    }
```

## Installation

1. Go to `Extensions`
2. Search for `Clojure Warrior`
3. Install
4. Restart Visual Studio Code (or click `Reload window`)
5. Open a Clojure/ClojureScript/EDN file

## Workign on Clojure Warrior

Compiling:

```
cd clojure-warrior
npm install
npm run watch
```

Installing dev version locally:

```
ln -s `pwd` ~/.vscode/extensions/tonsky.clojure-warrior-0.2.0
```

Publishing:

```
vsce publish
```

## License

[MIT License](https://github.com/tonsky/clojure-warrior/blob/master/./LICENSE.txt)
