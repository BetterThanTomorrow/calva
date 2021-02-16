(ns hello-clojure)

;; A lot of this is from 
;; https://clojure.org/guides/learn/syntax
;; where you can read more about each concept.

;; In Clojure everything is an expression.
;; (There are no statements.) Unless there is
;; en error when evaluating the expressions there
;; is always a return value (which is sometimes `nil`).

;; Literals evaluate to themselves.
;; (Alt+Enter and Ctrl+Enter, remeber?)

;; Numeric types
42        ; integer
-1.5      ; floating point
22/7      ; ratio
;; (There are more numeric types than this)

;; Character types
"hello"         ; string
\e              ; character
#"[0-9]+"       ; regular expression

;; Symbols and idents
map             ; symbol
+               ; symbol - most punctuation allowed
clojure.core/+  ; namespaced symbol
nil             ; null value
true false      ; booleans
:alpha          ; keyword
:release/alpha  ; keyword with namespace

;; Clojure has literal syntax for four collection types
;; They evaluate to themselves.
'(1 2 3)     ; list (a quoted list, more about this below)
[1 2 3]      ; vector
#{1 2 3}     ; set
{:a 1 :b 2}  ; map

;; They also compose
'(1 [1 #{1 {:a 1 :b '(1 2 3)}}])

;; So far you have been able to evaluate all examples.
;; It's because we quoted that list.
;; Actually lists look like so
(1 2 3)
;; If you evaluate that, you'll get an error:
;; => class java.lang.Long cannot be cast to class clojure.lang.IFn
;; (Of course, the linter already warned you.)
;; This is because the Clojure will try to call
;; `1` as a function. When evaluating unquoted lists
;; the first element in the list is regarded as being
;; in ”function position”. A Clojure program is data. 
;; In fancier words, Clojure is homoiconic:
;; https://wiki.c2.com/?HomoiconicLanguages
;; This gives great macro power, more about that below

;; Here are some lists with proper functions at
;; position 1:
(str 1 2 3 4 5 :foo)
(< 1 2 3 4 5)
(*)
(println "From Clojure with ♥️")
(reverse [5 4 3 2 1])
;; Everything from position 2 and up are
;; handed to the function as arguments

;; You define new functions and bind them to names
;; in the current namespace using the macro `defn`.
;; It's a very flexible macro. Here's a simple use:
(defn add2
  [arg]
  (+ arg 2))
;; It defines the function `add2` taking one argument.
;; The function body calls the core functions `+`
;; with the arguments `arg` and 2.
;; Evaluating the form will define it and you'll see:
;; => #'hello-clojure/add2
;; That's a var ”holding” the value of the function
;; You can now reference the var using the symbol
;; `add2`. Putting it in the function position of a
;; list with 3 in the first argument position and 
;; evaluating the list gives us back what?
(add2 3)

;; Clojure has an extensive core library of functions
;; and macros. See: https://clojuredocs.org for a community
;; driven Clojure core (and more) search engine.
;; The core libarary is built with the functions and macros
;; in the library itself. Bootstrapping the library is
;; a few (15-ish) built-in primitive forms,
;; a k a ”special forms”.

;; You have met one of these special forms already:
(quote (1 2 3)) 
;; The doc hover of the symbol `quote` tells you that
;; it is a special form.

;; Wondering where you met this special form before?
;; We used the shorthand syntax for it then:
'(1 2 3)

;; Convince yourself they are the same:
(= (quote (1 2 3))
   '(1 2 3))
;; Clojure has value semantics. Any data structures
;; that evaluate to the same data are equal,
;; no matter how deep or big the structures are.
(= [1 [1 #{1 {:a 1 :b '(:foo bar)}}]]
   [1 [1 #{1 {:a (- 3 2) :b (quote (:foo bar))}}]])

;; ... but that was a detour, back to special forms.
;; Offical docs:
;; https://clojure.org/reference/special_forms#_other_special_forms

;; A very important special form is `fn` (which is
;; actually four special forms, but anyway).
;; Without this form we can't define new functions.
;; The following form evaliates to a function which 
;; adds 2 to its argument.
(fn [arg] (+ arg 2))

;; Calling the function with the argment 3:
((fn [arg] (+ arg 2)) 3)

;; Another special form is `def`. It defines things,
;; giving them namespaced names.
(def foo :foo)
foo

;; With these two special foms we can define functions
(def add2-2 (fn [arg] (+ arg 2)))
(add2-2 3)

;; This is what the macro `defn` does.
;; We can use the function `macroexpand` to see this:
(macroexpand '(defn add2
                [arg]
                (+ arg 2)))

;; Yet another super duper important special form:
(if 'test
  'value-if-true
  'value-if-false)
;; Rumour has it that all conditional constructs (macros)
;; are built using `if`. Try imagine a programming language
;; without conditionals!


;; To be continued...


;; Learn much more Clojure at https://clojure.org/
;; There is also ClojureSript, the same wundeful language,
;; for JavaScript VMs: https://clojurescript.org
