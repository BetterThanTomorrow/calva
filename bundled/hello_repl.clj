(ns hello-repl)

;; Alt+Enter evaluates ”top level” forms. Top level
;; meaning the outermost ”container” of forms, which
;; is the file. Place the cursor anywhere inside this 
;; function and give it a try.
(defn greet
  "I'll greet you"
  [name]
  (str "Hello " name "!"))
;; To clear inline results display, press ESC

;; Ctrl+Enter evaluates the ”current” form
;; Try with the cursor at different places
(def foo
  [1 2 "three four"])
;; You might discover that Calva regards words in
;; strings as forms. Don't panic if `three` causes
;; en evauation error. It is not defined, since
;; it shouldn't be. You can define it, of course,
;; just for fun and learning:

;; Top level eval these 
(def three 3)
(def four "four")
;; Then eval current form inside the string above
;; Calva sends to the REPL whatever you ask it send.

;; Forms inside `(comment ...)` are also top level
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
;; basics of structural editing in Calva

;; Learn more about Calva at https://calva.io 
;; Clojure language basics: https://clojure.org/guides/learn/syntax

"Hello REPL is ready wit some things for you to try."