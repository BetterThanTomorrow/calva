# 0.1.6

- Avoid bracket styles bleeding into text typed next to them

# 0.1.5

- Don’t show matched brackets inside selection (#4)
- Do not alter `editor.matchBrackets` in config dynamically (#3)
- Showing matching bracket immediately since it’s fast (#5)
- Jump to match should scroll if needed (#2)

# 0.1.4

- More distinct rainbow colors by default
- Default settings support both dark and light themes

# 0.1.3

- New command: `clojureWarrior.jumpToMatchingBracket`
- New command: `clojureWarrior.selectToMatchingBracket`
- `editor.matchBrackets` is set to false only for Clojure editors
- `matchPairs` is scheduled asynchronously not to slow down text editing

# 0.1.2

- Highlight bracket pairs
- Added config param: `"clojureWarrior.matchedBracketStyle": {"backgroundColor": "#E0E0E0"}`

# 0.1.1

Added configuration parameters:
  - `"clojureWarrior.bracketColors": ["#000", "#999", ...]`
  - `"clojureWarrior.cycleBracketColors": true`
  - `"clojureWarrior.misplacedBracketStyle": { "border": "2px solid #c33" }`

# 0.1.0

- Initial release
- Rainbow Brackets