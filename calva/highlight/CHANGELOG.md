# 0.2.4 - July 12, 2019

- Fixed trailing whitespace in comment, symbols with word comment in them (#15, #17)

# 0.2.3 - July 10, 2019

- Do not merge defaults for `commentFormStyle` and `ignoredFormStyle`

# 0.2.2 - July 10, 2019

- Comment decoration (#14 by @PEZ)

# 0.2.1 - July 4, 2019

- Removed `configurationDefault` as it was conflicting with Calva (#13)

# 0.2.0

- Option to disable rainbow brackets `clojureWarrior.enableBracketColors` (#12)
- Handle setting `clojureWarrior.bracketColors` to empty array (#12)
- Handle config changes when done from Setting GUI
- Disable default `editor.matchBrackets` for Clojure files

# 0.1.8

- Highlight and match compound brackets: `#()`, `#{}`, `#?()`, `#?@()` (#10, thx @maratynsky)

# 0.1.7

- Show mismatched brackets on scrollbar (#7, #8)

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