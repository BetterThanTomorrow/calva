(ns notebook)

"string1" "string2"
;; A line comment
;; block

(def hover-map
  {:stuff "in-here"
   :ohter "yeah"
   ;; Yada yada
   :deeper {:a 1, "foo" :bar, [1 2 3] (vec (range 2000))}})
;; Foo

;; Line comment, line 1
;; 
;; Line comment, line 2
(defn foo []
  (println "bar"))

(foo)

;; A line comment

hover-map

"<html> <body>testing<h2>HTML Image</h2><img src='https://raw.githubusercontent.com/BetterThanTomorrow/calva/dev/assets/calva-64h.png'><iframe width='560' height='315' src='https://www.youtube.com/embed/dQw4w9WgXcQ' title='YouTube video player' frameborder='0' allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture' allowfullscreen></iframe></body></html>"
; foo
(comment
  (+ 40 2)

  42

  42/1

  "forty-two")

(def forty-two
  (+
   40
   1
   1))

; c3

;c4

"one"

;c5

"two"

;c6
"three"
;c7

"four"
;c8
:five

;c9
six

:seven
"eight"
nine

ten :eleven "twelve"

; c10

:thirteen

"fourteen"

;c11
;c12

:fifteen "sixteen" seventeen