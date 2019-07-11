;; Clojure Warrior

(()))
(((((((((((((((((((())))))))))))))))))))
[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]
{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}
((()))[[[]]]
([{)]}
())))
[]]]]
{}}}}
)
("--)--")
("--)--
--)--")
(;;---)
)
(\)\()
("--\"--)--")
;; ((()))
;; ())) "a[{(]})bc"
;; \
"()"
;; \
(((((())))))
([ { }()[]] )


(
    #( )
    #{ }
    #?( )
    #?@( )
    #_( )
)

(comment
  (comment (foo bar)))
(defn foo
  (let [x "y"]
    {:foo "bar"
     :bar (comment (fn [x]
                     (let [foo :bar])
                     (str foo)))
     :baz x}))
(comment
  (foo 2)
  (Math/abs -1)
  (range 10)
  (println "I ❤️Clojure")
  ([{} () []]))
[comment]
(foo) comment (bar)
"(comment foo)"
foo(comment)bar
( comment )
(
 comment "[foo]")
(comment
  (Math/abs -1)
  (range 10)
  (println "I ❤️Clojure")
  ([{} () []]))
( comment
  foo)
(comment foo (comment bar))
(foo (comment ({["(comment)"]})) ([{"(comment)"}]))

#_foo bar
#_ foo bar
#_,foo,bar
#_
foo bar
#_
foo
bar
#_(:bar [#{foo}])
([{#_"foo"}])
[:a
 #_
 [:b
  [:c {:d :e}]]
 [:b
  [:c {:d :e}]]]
(comment 
  (foo #_"bar" baz))
#_{:foo "foo"
   :bar (comment [["bar"]])}
#_^{:foo foo} ^{:foo foo}
#_@foo @foo
#_@(foo bar)  @(foo bar)
#_'(foo bar) '(foo bar)
#_`(foo bar) `(foo bar)
#_~(foo bar) ~(foo bar)
#_'foo 'foo
#_#foo #foo
#_@foo @foo
#_~foo ~foo
#_#"foo\sbar" #"foo\sbar"