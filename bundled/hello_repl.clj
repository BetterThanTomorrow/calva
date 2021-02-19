(ns hello-repl)

;; We will often refer to commands by their name
;; Use the VS Code Command palette to search for
;; commands. All Calva commands are prefixed with,
;; yes, Calva. The default keyboard shortcut for
;; the command palette is Ctrl+Shift+P (Win/LLnux)
;; Cmd+Shift+P (Mac).
;; The command palette displays any keyboard
;; shortcut bound to the command.


;; Alt+Enter evaluates ”top level” forms. Top level
;; meaning the outermost ”container” of forms, which
;; is the file. Place the cursor anywhere inside this 
;; function and give it a try.
(defn greet
  "I'll greet you"
  [name]
  (str "Hello " name "!"))

;; Forms inside `(comment ...)` are also top level
(comment
  (greet "World"))
;; You should see "Hello World!" displayed inline,
;; and also printed to the `output.calva-repl` editor,
;; a k a ”The Outout Window”, a k a ”The REPL Window”.
;; To clear inline results display, press ESC.

;; Anything printed to stdout is not shown inline
(comment
  (println (greet "World")))
;; You should see the result of the evaluation, nil,)
;; inline, and ”Hello World!” followed by the result
;; printed to the output window.

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
(comment
  (def three 3)
  (def four "four"))
;; Then eval current form inside the string above
;; Calva sends to the REPL whatever you ask it send.

;; Repeating an important concept: Forms inside
;; `(comment ...)` are also concidered top level
;; Alt+Enter at different places below to get a
;; feel for it.
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

;; Since evaluating Clojure expressions is so
;; easy and fun. Some times you happen to evaluate
;; something that never finishes, or takes to long
;; to finish. For this, Calva has a command named
;; *Interrupt Running Evaluations*. You will need
;; it if you top-level evaluate this:
(comment
  (def tmp1 (dorun (range))))

;; Pleas continue to hello_paredit.clj to learn the
;; very basics of structural editing in Calva.

;; Learn much more about Calva at https://calva.io 

"hello_repl.clj is loaded, and ready with some things for you to try."