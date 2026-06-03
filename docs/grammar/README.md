# Clojure syntax highlighting grammar

Calva ships a TextMate grammar for Clojure and related file types: `clojure.tmLanguage.json` at the repository root. VS Code loads it via `package.json` → `contributes.grammars`.

The grammar was originally derived from [atom/language-clojure](https://github.com/atom/language-clojure). It is now **hand-maintained** in this repository.

## Editing the grammar

1. Edit `clojure.tmLanguage.json` (valid JSON; `firstLineMatch` uses `(?x)` extended mode like upstream Atom grammars).
2. Run grammar unit tests:

   ```sh
   npm run unit-test
   ```

   With **Calva Watch Test TS** running (`npm run unit-test-watch`), saving `clojure.tmLanguage.json` re-runs the suite automatically.

   The suite lives in `src/extension-test/unit/calva-fmt/clojure-grammar-test.ts` and tokenizes via `vscode-textmate` (same engine VS Code uses).

3. Spot-check highlighting in VS Code on representative `.clj` / `.cljs` / `.cljc` files and the Calva REPL prompt if you touched `#prompt` or related rules.

## Tests

| Command | What it runs |
|---------|----------------|
| `npm run unit-test` | All unit tests, including `clojure-grammar-test.ts` |
| `npx mocha --exit --require ts-node/register 'src/extension-test/unit/calva-fmt/clojure-grammar-test.ts'` | Grammar tests only |

See also [things-to-consider.md](./things-to-consider.md) for edge cases in real-world Clojure-ish files.
