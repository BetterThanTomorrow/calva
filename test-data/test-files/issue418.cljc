(ns issue418)

(comment
  '(1)|
   ;; => Execution error (ClassCastException) at nrepl-pprint-datomic.core/eval9432 (form-init7429449344366744362.clj:12).
   ;;    class java.lang.Long cannot be cast to class clojure.lang.IFn (java.lang.Long is in module java.base of loader 'bootstrap'; clojure.lang.IFn is in unnamed module of loader 'app')

  '|(1)
   ;; => Execution error (ClassCastException) at nrepl-pprint-datomic.core/eval9440 (form-init7429449344366744362.clj:16).
   ;;    class java.lang.Long cannot be cast to class clojure.lang.IFn (java.lang.Long is in module java.base of loader 'bootstrap'; clojure.lang.IFn is in unnamed module of loader 'app')

  |'(1)
  ;; => Syntax error reading source at (REPL:20:1).
  ;;    EOF while reading

  @foo|
   ;; => Syntax error compiling at (core.cljc:1:8100).
   ;;    Unable to resolve symbol: foo in this context

  |@foo
  ;; => Syntax error reading source at (REPL:28:1).
  ;;    EOF while reading

  #?(:cljs :foo :clj :bar)|
    ;; => Execution error (IllegalArgumentException) at nrepl-pprint-datomic.core/eval7999 (form-init7514181033060422158.clj:32).
    ;;    Wrong number of args passed to keyword: :cljs

  |#? (:cljs :foo :clj :bar)
  ;; => Syntax error reading source at (REPL:36:1).
  ;;    EOF while reading character

  #{:foo :bar}|
   ;; => {:foo :foo}

  #{:foo :bar}
  ;; => Syntax error reading source at (REPL:43:1).
  ;;    EOF while reading character
  )

