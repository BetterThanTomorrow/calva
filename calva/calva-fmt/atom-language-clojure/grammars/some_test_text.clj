(default default) (defallt defallt)

#_1.2M 1.2M

#_true true #_false false

#_nil nil

#_{:åkerö foo} {:åkerö foo}

#_#{:åkerö foo} #{:åkerö foo}

#_^{:åkerö foo} ^{:åkerö foo}


{:foo #_bar :bar #_foo'foo #_'foo'bar #_'#foo'bar}

#_:foobar :foobar

#_1.2M 1.2M

#_[:div#foo.bar
   [:p "foo"]]

[:div#foo.bar
   [:p "foo"]]

[:div#foo.bar
 #_[:p "foo"
    [:span [:a {:href "#"}]]]
 [:span [:i "bar"]]]


#_(default default) (default defallt)

#_@foo @foo

#_(foo bar) (foo bar)

#_ (foo bar) (foo bar)

#_@(foo bar)  @(foo bar)

#_'(foo bar) '(foo bar)

#_`(foo bar) `(foo bar)

#_~(foo bar) ~(foo bar)

#_(FOOBAR :bar) (FOOBAR :bar)


#_(defn scroll-to-bottom [state]
    (:cljs
     (let [comp (:rum/react-component state)
           message-box (js/ReactDOM.findDOMNode comp)
           scroll-height (.-scrollHeight message-box)]
       (set! (.-scrollTop message-box) scroll-height)))
    state)

(def foo :bar)

#_foo foo

#_'foo 'foo

#_#foo #foo

#_@foo @foo

#_~foo ~foo


#_#?(:cljs foo
     :clj bar)
    #?(:cljs foo
       :clj bar)

#_(:cljs foo
         :clj bar)
(:cljs foo
       :clj bar)

#_'(FOOBAR :bar) '(FOOBAR :bar)

#_(FOOBAR :bar) (FOOBAR :bar)

#_"foo" "foo"

#_#"foo\sbar" #"foo\sbar"

(defn foo []
    :bar
    #_{:foo :bar
        (comment
          #"\sfoo" bar)

        '(foo :bar ["foo" #"\s*"]) {:bar}}
    (foo))

(defn foo [])

#_[:bar
   [:p.apa]]
[:bar
 [:p.apa]]

#_((foo)) #((foo))

#_#{:foo :bar
    (comment
      #_#"\sfoo" bar)

    #_'(foo :bar ["foo" #"\s*"]) {:bar}}
