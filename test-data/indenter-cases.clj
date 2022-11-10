#_:clj-kondo/ignore
(ns foo
  {:clj-kondo/config '{:linters {:unresolved-symbol {:level :off}
                                 :unused-bindings {:level :off}}}})

; Should indent like `(def ...`
(foo/defbars body
  [:body {}])

; Should not indent like `(def ...`

(foo/ddefbars body
  [:body {}])


; Should indent like `(let ...`
(clojure.core/let [x :x]
  x)

; Should not indent like `(let ...`
(clojure.core-let [x :x]
  x)

; Should indent using `[[:inner 0]]`
; Assuming a custom `cljfmt.edn` is used and it has:
; `{:indents {inner-0-form [[:inner 0]]}}`
(foo/inner-0-form :a
  ss
  :foo)

; Should not indent using `[[:inner 0]]`
(foo-inner-0-form :a
  ss
  :foo)

; Should indent like
(deftype MyType [arg1 arg2]
  IMyProto 
  (method1 [this] |(print "hello")))
