
From @sogaiu:
@pez in processing clj-ish files from github using tree-sitter or clj-kondo, here are a few things that come up that can lead to errors / warnings:
* template files - people do things like: (ns {{namespace}}.rendering or :{{name}} (mustache?) -- small number of instances of other styles too
* missing, misplaced, or incorrectly placed closing delimiters
* non-clojure text in (comment or #_ blocks
* questionable(?) symbols and keywords - things that the repl might accept, but for which i didn't find a statement of support (e.g. # in keywords, keywords with multiple slashes in them) (edited)

```
Error: Property failed after 58 tests
{ seed: -1913189269, path: "57:0:0:0:0:0:0:0:0:0:0:2:1:1:1:1:1:1:1:1:1:1:1:1:1:1:2:9:8:8:8:8:8:8:8:0:0:0:0:0:0", endOnFailure: true }
Counterexample: ["##~"]
Shrunk 40 time(s)
Got error: AssertionError: expected 'junk' to equal 'id'
```