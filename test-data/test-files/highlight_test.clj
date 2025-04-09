;; Clojure Warrior

(())
(((((((((((((((((((())))))))))))))))))))
[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]
{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}
((()))[[[]]]
([{}])
()
[]
{}

("--)--")
("--)--
--)--")
();;---)

(\)\()
("--\"--)--")
;; ((()))
;; ())) "a[{(]})bc"
;; \
"()"
;; \
;;
(((#((())))))
([ #{ }()[]])


(
    #()
    #{}
    #?()
    #?@()
    #_())

(if comment :a :b)

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
  (foo "Calva")
  (Math/abs -1)
  (range 10)
  (println "I ❤️Clojure")
  ([{} () []]))


    (comment
      (+ (* 2 2)
         2)
      (Math/abs -1)
      (defn hello [s]
        (str "Hello " s))
      (hello "Calva REPL")
      (range 10)
      "I ❤️Clojure")

[comment]
(foo) comment (bar)
"(comment foo)"
foo(comment)bar
(def contains-comment (go-fish))
( comment)
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

#_#_(1) (2 2)

#_
#_
#_

1

2

3
4

#_
#_
2
(1 (1))
3

#_
#_
#_
1
(2 (2))
(3 3)
4

#_#_#_#(1) 2 (3 4) (4) 5

#_#_#_ (1) (2) (3 4) (4) 5

#_ (1)2(3) (4)

#_1(2)

(let [#_#_x (get c :x "x")
      y (get c :y "y")
      #_ #_ z (get c :z "z")
      å {:ä :ö}]
  (str y å #_#_x z))

#_x y z

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