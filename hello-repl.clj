(ns hello-repl)

;; Alt+Enter evaluates ”top level” forms
;; Try it with the cursor anywhere inside this function
(defn greet [name]
  (str "Hello " name "!"))

;; To clear inline results display, press ESC

;; Ctrl+Enter evaluates the ”current” form
;; Try it with the cursor at different places on the line below
(def foo {:foo "bar"})

;; `comment` forms create a new ”top level” context
;; Try Alt+Enter at different places below
(comment
  (greet "World")
  foo
  (println (greet "side effect"))
  (+ (* 2 2)
     2)
  (Math/abs -1)
  (greet "Calva REPL")
  (range 10)
  "I ♥️ Clojure")

;; Learn more about Calva at https://calva.io 
;; Clojure language basics: https://clojure.org/guides/learn/syntax