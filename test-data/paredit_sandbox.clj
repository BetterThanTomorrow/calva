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


;; Example 5 -- end of string
"This| is a string"

;; Example 6 -- to the newline
"This| is a multiline 
string. "

;; Example 7 -- bindings
;; killing the bound symbol also kills the corresponding expr
(let [a 23
      b (+ 4
           5
           9)
      m {:a 1}
      c "hello"]
  (+ a b))

;; Exmaple 8 -- map key value pairs
;; killing from :c includes the corresponding value
{:a 1
 :b 2
 :c {:d 4
     :e 5}}