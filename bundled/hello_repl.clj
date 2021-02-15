(ns hello-repl)

;; Alt+Enter evaluates ”top level” forms
;; Place the cursor anywhere inside this 
;; function and try
(defn greet
  "I'll greet you"
  [name]
  (str "Hello " name "!"))

;; To clear inline results display, press ESC

;; Ctrl+Enter evaluates the ”current” form
;; Try with the cursor at different places
(def foo {:foo "bar"})

;; Forms inside `(comment ...)` are also ”top level”
;; Try Alt+Enter at different places below
(comment
  "I ♥️ Clojure"
  (greet "World")
  foo
  ;; Also try the commands *Show Hover*,
  ;; *Show Definition Preview Hover*
  ;; *Go to Definition*  
  (println (greet "side effect"))
  (+ (* 2 2)
     2)
  ;; Here too, if you have Java sources installed
  (Math/abs -1)
  (greet "Calva REPL")
  (range 10))
;; Google Rich Comments, if you are new
;; to this style of coding.

;; See hello-paredit.clj to learn the very
;; basic of structural editing in Calva

;; Learn more about Calva at https://calva.io 
;; Clojure language basics: https://clojure.org/guides/learn/syntax