(ns paredit-sandbox)
;; = Paredit sandbox

;; == Paredit kill-right
;; https://github.com/BetterThanTomorrow/calva/issues/1024

;; === Example 1 - s-expresions
;; Expressions starting on the current line past the cursor are killed
;;



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
;; Killing the bound symbol also kills the corresponding expr for a, b, m and c.
;; Not by design but interesting and useful emergent behavior.
;; killing from d of course kills rest of the vector's elements
(let [a 23
      b (+ 4
           5
           9)
      m {:a 1}
      c "hello"
      d 19 e 31]
  (+ a b))

;; Exmaple 8 -- map key value pairs
;; killing from :c includes the corresponding value
{:a 1
 :b 2
 :c {:d 4
     :e 5}}

;; Example 9 -- deleteing from #_ should delete whole expr
[#_(comment
     (+ 2 3))]

;; Example 10 -- deleting from | should delete to eol
;; | (23 34
;;   )



;; Example 11 -- Deleting should delete whole expr to closing ]
| 24 [1]

43 [1 2
    3]

;; Example 12 -- Deleting after a comment kills up to newline
;;| delete me

;; Example 13 -- Delete empty lines

;; Example 14 -- newline in string, deletes to end of string
["abc| def\n ghi" "this stays"]


;; Example 15 -- Heisenbug should delete up to and including g]
#_|[a b (c d
           e
           f) g]
:a

;; Kill right

"This |
    needs to find the end of the string."


(map inc (map inc|
              (range 3)))

(map inc (map inc|
              ))

; https://github.com/BetterThanTomorrow/calva/issues/2327
; Should delete `#`
[#|[]]
; Should not delete `#`
(#|())


(comment
  (a b (c
        d) e)
  (a ;; comment
   e)
  "This is a string
   it's multiline"
  #_[a b (c d
            e
            f) g]
  :a)
