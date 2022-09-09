;; starting line comment

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

"<html> <body>testing<h2>HTML Image</h2><img src='https://raw.githubusercontent.com/BetterThanTomorrow/calva/dev/assets/calva-64h.png'><iframe width='560' height='315' src='https://www.youtube.com/embed/dQw4w9WgXcQ' title='YouTube video player' frameborder='0' allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture' allowfullscreen></iframe></body></html>"

(def meta-test
  ^{:portal.viewer/default :portal.viewer/hiccup}
  [:h1 "hello, world"])

meta-test

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

(comment
  forty-two

  (foo)
  ^{:portal.viewer/default :portal.viewer/hiccup}
  [:h1 "hiccup rocks"]
  ;; rich or poor comment?
  (tap> "stuff"))
