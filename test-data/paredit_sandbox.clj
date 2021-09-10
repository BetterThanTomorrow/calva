(ns paredit-sandbox)
;; = Paredit sandbox

;; == Paredit kill-right
;; https://github.com/BetterThanTomorrow/calva/issues/1024

;; === Example 1 - s-expresions
;; Expressions starting on the current line past the cursor are killed
(a| b (c
       d) e)

;; Example 1b
(aa| (c (e
         f)) g)

;; === Example 2 - comments
;; Comment killed
(a| ;; comment
 e)

;; Example 3 - newline
;; newline killed
(a|
 e)

;; Example 4 - end of list
;; Don't kill past it

(a b (c |)
   e)