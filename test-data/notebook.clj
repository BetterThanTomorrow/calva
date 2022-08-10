(ns notebook)

;; A line comment
;; block

(def hover-map
  {:stuff "in-here"
   :ohter "yeah"
   ;; Yada yada
   :deeper {:a 1, "foo" :bar, [1 2 3] (vec (range 2000))}})

;; Line comment, line 1

;; Line comment, line 2
(defn foo []
  (println "bar"))

(foo)

;; A line comment

hover-map

"<html> <body>testing<h2>HTML Image</h2><img src='https://raw.githubusercontent.com/BetterThanTomorrow/calva/dev/assets/calva-64h.png'></body></html>"

(comment
  (+ 40 2)

  42

  42/1

  "forty-two"
  )

(def forty-two
  (+
   40
   1
   1))