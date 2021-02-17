(ns hello-clojure
  (:require [clojure.string :as string]))

;; Start with loading this file
;; Ctrl+Alt+C Enter

;; THen Alt+Enter this
"Hello World"

;; This guide will try to give you a very basic
;; understanding of the Clojure language. Basic in
;; the sense that it is not comprehensible. Basic
;; in the sense that it is foundational. With the
;; foundations in place you'll have a good chance
;; of formmulating your questions, googling for
;; information, make sense of code you stumble
;; across, and so on.

;; There are links here and there, ctrl/cmd-click
;; them to open them in a browser. Here's the first
;; such link; 
;; https://clojure.org/guides/learn/syntax
;; There you can read more about the concepts
;; mentioned in this guide.

;; The way to use the guide is to read about the
;; concepts and evaluate the examples. Please Feel
;; encouraged to edit the examples, add new code
;; and evaluate that. Evaluate this to warm up:

(str "Learning " "by" " evaluating")

;; = EXPRESSIONS =
;; In Clojure everything is an expression.
;; (There are no statements.) Unless there is
;; en error when evaluating the expressions there
;; is always a return value (which is sometimes `nil`).

(comment
  ;; = LITERALS =
  ;; Literals evaluate to themselves.
  ;; (Remember your friends:
  ;;   Alt+Enter and Ctrl+Enter)

  ;; Numeric types
  42        ; integer
  -1.5      ; floating point
  0.18e2    ; exponent
  7.8M      ; big decimal
  22/7      ; ratio
  3N        ; big integer
  0x12      ; hex
  022       ; octal
  2r10010   ; base 2
  ;; (Hexadecimal and octal)

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

  ;; == STRINGS ==
  ;; Somewhere in between the atomic literals and
  ;; the collections we have strings. They are sometimes
  ;; treated as sequences (a cool abstraction we'll
  ;; talk more about).
  ;; Strings are enclosed by double quotes. 
  "A string can be
   multiline, but will contain any leading spaces."
  "Write strings
like this, if leading spaces are no-no."
  ;; (The single quote is used for something else.
  ;; You'll see to what a bit later.)
  )

(comment
  ;; = COLLECTIONS =
  ;; Clojure has literal syntax for four collection types
  ;; They evaluate to themselves.
  '(1 2 3)     ; list (a quoted list, more about this below)
  [1 2 3]      ; vector
  #{1 2 3}     ; set
  {:a 1 :b 2}  ; map

  ;; They also compose
  '(1 [1 #{1 {:a 1 :b '(1 2 3)}}])

  ;; = FUNCTIONS =
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
  (= "1"
     (str "1")
     (str \1))
  (println "From Clojure with ♥️")
  (reverse [5 4 3 2 1])
  ;; Everything after the first position is
  ;; handed to the function as arguments

  ;; Note: We refer to literals, symbols and literal
  ;; collections, collectivelly as forms, sometimes,
  ;; sexprs: https://en.wikipedia.org/wiki/S-expression

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
  )

(comment
  ;; = SPECIAL FORMS =
  ;; The core libarary is composed from the functions and macros
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

  ;; Convince yourself they are the same witg the `=` function:
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
  ;; The following form evaluates to a function which 
  ;; adds 2 to its argument.
  (fn [arg] (+ arg 2))

  ;; Calling the function with the argument 3:
  ((fn [arg] (+ arg 2)) 3)

  ;; Another special form is `def`. It defines things,
  ;; giving them namespaced names.
  (def foo :foo)
  ;; ”Defining a thing” means that a var is created,
  ;; holding the value, and that a symbol is bound
  ;; to the var. Evaluating the symbol, picks up the
  ;; value from the var it is bound to
  foo
  ;; The var can be accessed using the `var` special
  ;; form.
  (var foo)
  ;; You will most often see the var-quote shorthand
  #'foo

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

  ;; We'll return to `if` and conditionals. Let's wrap
  ;; the special forms section up with just noting that
  ;; together with _how_ Clojure reads and evaluates code,
  ;; the special forms make up the Clojure langugage
  ;; itself. The next level och building blocks are
  ;; macros. But let's investigate this with how code
  ;; is read first...
  )

(comment
  ;; = THE READER =
  ;; https://clojure.org/reference/reader
  ;; The Clojure Reader is responsible for reading text,
  ;; making data from it, which is what the compiler gets.
  ;; The Reader is where literals, symbols, strings, lists,
  ;; vectors, maps, and sets are picked apart and
  ;; re-assembled, figuring out what is a function,
  ;; a macro or special form.

  ;; In doing this whitespace place a key role and there
  ;; us also some extra syntax rules are in play.

  ;; == WHITESPACE ==
  ;; Most things you would think counts as whitespace
  ;; is whitespace, and then there is also that Clojure,
  ;; being a LISP, does not need commas to separate
  ;; list items, since whitespace is enough. However,
  ;; Commas can be used for this, since:
  ;; commas are whitespace!
  (= '(1 2 3)
     '(1,2,3)
     '(1, 2, 3)
     '(1,,,,2,,,,3))
  ;; (There are no operators in Clojure, `=` is a
  ;; function. It will check for equality of all
  ;; arguments it is passed.)

  ;; == LINE COMMENTS ==
  ;; The Reader skips reading everything on a line from
  ;; a semicolon. This is unstructured comments in
  ;; that if you start a form
  (range 1 ; 10)
  ;; and then place a line commment so that the closing
  ;; bracket of that form gets commented out, the
  ;; structure breaks.
         )
  ;;     ^ Healing the structure.        
  ;; If you remove the semicolon on the opening form
  ;; above, make sure to also remove this closing one.           

  ;; Since everything on the line is ignored, you can
  ;; add as many semicolons as you want.
  ;;;;;;;;;; (hidden from the Reader)
  ;; It's common to use two semicolons to start a full
  ;; line comment. 

  ;; == EXRA SYNTAX ===
  ;; We've already seen the single quote
  'something
  ;; Which is, as we have seen, is transfromed to
  (quote something)
  ;; There are some more quoting, and even splicing
  ;; symbols, which we won't cover in this guide.

  ;; === Deref ===
  ;; Clojure also has reference types, we'll discuss
  ;; (briefly) the most common one, `atom`, later.
  (def an-atom (atom [1 2 3]))
  (type an-atom)
  ;; To access value from a reference:
  (deref an-atom)
  (type (deref an-atom))
  ;; This is so common that there is shorthand syntax
  @an-atom
  (= (deref an-atom)
     @an-atom)
  ;; It's a common mistake to forget to deref
  (first an-atom)
  (first @an-atom)

  ;; === THE DISPATCHER (HASH SIGN) ===
  ;; Regular expressions have literal syntax, they are
  ;; written like strings, but with a hash sign in front
  #"reg(?:ular )?exp(?:ression)?"
  ;; Regexps are handled by the host platform, so they
  ;; are Java regexes in this tutorial.
  (re-seq *1 "regexp regular expression")
  ;; *1 is a special symbol for a variable holding the
  ;; value of the last evaluation result.

  ;; That hash sign shows up now and then, for instance
  #(+ % 2)
  ;; Which is special syntax for a shorthand way to
  ;; specify a function, a k a function literals.
  ;; The example above is equivalent to
  (fn [arg] (+ arg 2))
  ;; Nesting function literals is forbidden activity
  ;; (#(+ % (#(- % 2) 3)))
  ;; (thankfully)

  ;; The hash sign has a special role. It is a k a
  ;; Dispatch. Depending on what character is following
  ;; it, different cool things happen.
  ;; In addition to sets, regexps and function literals
  ;; we have seen var-quotes in this guide
  #'add2

  ;; There is a very useful hash-dispatcher which
  ;; is used to make the Reader ignore the next form
  #_(str "The reader will not send this function call
to the compiler, if it is evaluated together with the
#_ marker.")
  ;; You'll need to select the ignore marker together with
  ;; the function call and use Ctrl+Enter, to make Calva
  ;; send the both the marker and the form to the Reader,
  ;; which will read it, then ignore it. ¯\_(ツ)_/¯
  ;; Since #_ ignores the next form it is a structural
  ;; comment mechanism, often used to temporarily disable
  ;; some code or some data
  (str "a" "b" #_(str 1 2 3 [4 5 6]) "c")
  ;; Ignore markers stack
  (str "a" #_#_"b" (str 1 2 3 [4 5 6]) "c")
  ;; Note that the Reader _will_ read the ignored form.
  ;; If there are syntactic errors in there, the
  ;; Reader will get sad, complain, and stop Reading.

  ;; Two more common #-variants you will see, and use,
  ;; are namespaced map keyword shorthand syntax and
  ;; tagged literals, a k a, data readers. Let's start
  ;; with the former:
  (= #:foo {:bar 'bar
            :baz 'baz}
     {:foo/bar 'bar
      :foo/baz 'baz})
  ;; Unrelated to the #: There is another shorthand for
  ;; speecifying namespaced keywords. Double colon
  ;; keywords get namespaced with the current namespace
  ::foo
  (= ::foo :hello-clojure/foo)

  ;; Tagged literals, then. It's a way to invoke functions
  ;; bound to the tags on the form following it.
  ;; https://clojure.org/reference/reader#tagged_literals
  ;; They are also referred to as data readers. You can
  ;; define your own. Here let it suffice with mentioning
  ;; the two build in ones.

  ;; #inst will convert the string it tags to an instance
  #inst "2018-03-28T10:48:00.000"
  (type *1)

  ;; #uuid will make an UUID of the string it tags
  #uuid "0000000-0000-0000-0000-000000000016"
  (java.util.UUID/fromString "0000000-0000-0000-0000-000000000016")

  ;; You now know how to read (in the sense of you
  ;; being a Clojure Reader) most Clojure code.
  ;; That said, let's skip going into the syntax
  ;; sugar and special forms for making host platform
  ;; interop extra nice.
  ;; https://clojure.org/reference/java_interop
  ;; Just a sneak peek:
  (.before #inst "2018-03-28T10:48:00.000"
           #inst "2021-02-17T00:27:00.000")
  ;; This invokes the method `before` on the date
  ;; object for year 2018 giving it the date from
  ;; year 2021 as argument.
  )

(comment
  ;; = MACROS =
  ;; Clojure has powerful data transformation
  ;; capabilities. We'll touch on that a bit later.
  ;; Here we want to highlight that this power can
  ;; be weilded for extending the language. 
  ;; Since Clojure code is structured and code data
  ;; Clojure can be used to produce Clojure code from
  ;; c

  ;; To be continued...

  ;; Learn much more Clojure at https://clojure.org/
  ;; There is also ClojureSript, the same wondeful language,
  ;; for JavaScript VMs: https://clojurescript.org
  )

"Hello Clojure"