(ns hello-paredit)

;; Start with loading this file
;; Ctrl+Alt+C Enter

;; Clojure is a LISP and therefore the code
;; is structural. Everything is literals or
;; ”symbols” organized in literal collections
;; (different kinds of lists).
;; Paredit helps you take advantage of this.

;; Alt+Enter this one
(->> ["I" "💖" "Paredit"]
     (interpose " ~ ")
     (apply str))
;; (To get into a good mood. 😍)

;; Paredit strict mode is active by default. 
;; It will help you to not delete brackets that
;; would break the structure of the code.
;; Use Alt+Backspace to override.
(defn strict-greet
  "Try to remove brackets and string quotes
   using Backspace or Delete. Try the same
   with the Alt key pressed."
  [name]
  (str "Strictly yours, " name "!"))
;; (Restore with *Undo* if needed.)

;; Select a form with *Paredit Expand Selection*
;; Repeat the command to expand one level more
(comment
  (-> 4
      (repeat (let [select-me 'bar]
                {:foo select-me}))
      (->>
       (repeat 3))
      (vec)))
;; There is also *Paredit Shrink Selection*

;; Move form-by-form using *Paredt Sexp Forward*
;; and *Paredit Sexp Backward*
(def move
  [{:zero 0}
   1 2 3
   "four"
   #:five {:bar 'baz}])
;; Also try *Paredit Select Forward/Backward*
;; All *Paredit Select ...* commands work together with
;; *Paredit Expand/Shrink Selection*

;; A structural delete a day keeps the doctor away
(defn delete
  "Search the Command Palette for *Paredit Kill*"
  [kill-forward kill-backward]
  [{:zero 0}
   1 2 3
   "four"
   #:five {:foo kill-forward
           :bar kill-backward}]
  "To delete and copy, use *Paredit Select ...*
   then *Cut*")

;; *Paredit Slurp* and *Paredit Barf* are handy
;; commands to move forms in and out of the current
;; list/vector/map/string
(def slurp-barf [{:barf-me "barf-me-too"}
                 'slurp-me-then-barf-me])

;; *Paredit Raise Sexp* replaces the enclosing
;; form with the ”current” form
(comment
  (def raise-me
    #:or-raise-me {:or-me [1 2 3 4]
                   :or-this-> #{1 2 3 4}}))

;; Pay attention to the keyboard shortcuts
;; displayed in the Command Palette 😀

;; Learn much more Paredit: https://calva.io/paredit

;; If you are new to Clojure, please continue
;; with `hello_clojure.clj` and evaluate your way
;; to some basic Clojure knowledge.