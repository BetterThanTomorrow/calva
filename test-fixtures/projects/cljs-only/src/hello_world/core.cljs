(ns hello-world.core)

;; Evaluate these forms by placing the cursor in them
;; and press Alt+Enter.

(defn hello [s]
  (println (str "Hello " s "!")))

(hello "ClojureScript World")

(comment
  ;; This is a Rich Comment block:
  ;;   https://youtu.be/Qx0-pViyIDU?t=1229
  ;; Evaluate the forms in it the same way as the ones above.

  (js/alert "Hello from the REPL!") ; check the browser
  (inc 1)
  (map inc [1 2 3])

  ;; Evalute these steps with Ctrl+Alt+Enter after each line.
  (-> js/document
      (.getElementById "app")
      (.-innerHTML)
      (set! "Hello ClojureScript REPL from Calva!")
      ;; reload browser page to restore the original content 😎
      )

  ;; Please edit the code in this block and see
  ;; what happens when you evaluate.
  )

;; Learn about the Calva REPL and about Clojure with
;; the command: Calva: Create a Getting Started REPL project*.