;; https://github.com/BetterThanTomorrow/calva/issues/1585

;; Confirm that structural editing works here:

(defn foo [{:keys [bar]}] 'baz)

;; Here a repro that works for at least one user:
;; Place the cursor to the right of the closing square bracket and press delete
;; until the text is `(let [a] a)`. Then highlight the select the closing square
;; bracket and press delete. Structural editing and rainbow parens is now broken.

(let [a "123"] a)


;; This reproduces it for me (PEZ)
;; Delete the closing square bracket
;; With the cursor behind `[a` do **Paredit Barf Forward**
;; BOOM

(let [a] a)

