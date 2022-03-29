;; https://github.com/BetterThanTomorrow/calva/issues/1622

;; Misbehaves in the indenter
(let [context|])

;; Behaves in the indenter
(let [contexs|])

;; (Both behave in the formatter)

;; Probably because `context` has default indents `[[:inner 0]]`

;; `[[:inner 0]]`
[fn|]

;; `[[:block 0]]`
[do|]

;; `[[:block 1]]`
[let|]

;; `[[:inner 0]]`
[foo|]

;; Also goes for maps and sets

{fn|}

#{fn|}