(ns calva.fmt.formatter-test
  (:require [calva.fmt.formatter :as sut]
            [cljs.test :include-macros true :refer [deftest is testing]]))

(deftest format-text-at-range
  (is (= "(foo)\n(defn bar\n  [x]\n  baz)"
         (:range-text (sut/format-text-at-range {:eol "\n" :all-text "  (foo)\n(defn bar\n[x]\nbaz)" :range [2 26]})))))

(deftest clojure-1-12-syntax
  (is (= {:range [1 10], :range-text "Long/1 a"}
         (sut/format-text-at-range {:all-text "^Long/1 a" :range [1 10]})))
  (is (nil? (:error (sut/format-text-at-range {:all-text "^Long/1 a" :range [1 10]})))))

(def all-text "  (foo)
  (defn bar
         [x]

baz)")

(def deftype-all-text
  "(deftype MyType [arg1 arg2]\n  IMyProto\n  (method1 [this]\n           (smth)))")

(deftest format-text-at-idx
  (is (= "(defn bar
    [x]

    baz)"
         (:range-text (sut/format-text-at-idx {:eol "\n" :all-text all-text :range [10 38] :idxs [11]})))) 
  (is (= [10 38]
         (:range (sut/format-text-at-idx {:eol "\n" :all-text all-text :range [10 38] :idxs [11]}))))
  (is (= [0 5]
         (:range (sut/format-text-at-idx {:eol "\n" :all-text "(\n\n,)" :range [0 5] :idxs [2]}))))
  (is (= "()"
         (:range-text (sut/format-text-at-idx {:eol "\n" :all-text "(\n\n,)" :range [0 5] :idxs [2]}))))
  (is (= "(deftype MyType [arg1 arg2]\n  IMyProto\n  (method1 [this]\n    (smth)))"
         (:range-text (sut/format-text-at-idx {:eol "\n" :all-text deftype-all-text :range [0 76] :idxs [68]}))))
  ;; TODO: Figure out why the extra space is not removed
  #_(is (= "a c"
           (:range-text (sut/format-text-at-idx {:eol "\n" :all-text "a  c" :range [0 4] :idxs [2]})))))

(def misaligned-text "(def foo
(let[a   b
aa bb
ccc {:a b :aa bb :ccc ccc}]
))")

(deftest format-aligned-text-at-idx
  (testing "Aligns associative structures when `:align-associative` is `true`"
    (is (= "(def foo
  (let [a   b
        aa  bb
        ccc {:a   b
             :aa  bb
             :ccc ccc}]))"
           (:range-text (sut/format-text-at-idx {:eol      "\n"
                                                 :all-text misaligned-text
                                                 :config {:align-associative? true}
                                                 :range    [0 56]
                                                 :idxs     [0]})))))

  (testing "Does not align associative structures when `:align-associative` is not `true`"
    (is (= "(def foo
  (let [a   b
        aa bb
        ccc {:a b :aa bb :ccc ccc}]))"
           (:range-text (sut/format-text-at-idx {:eol      "\n"
                                                 :all-text misaligned-text
                                                 :range    [0 56]
                                                 :idxs     [1]}))))))

(deftest format-trim-text-at-idx
  (testing "Trims space between forms when `:remove-multiple-non-indenting-spaces?` is `true`"
    (is (= "(def foo
  (let [a b
        aa bb
        ccc {:a b :aa bb :ccc ccc}]))"
           (:range-text (sut/format-text-at-idx {:eol      "\n"
                                                 :all-text misaligned-text
                                                 :config {:remove-multiple-non-indenting-spaces? true}
                                                 :range    [0 56]
                                                 :idxs     [0]})))))

  (testing "Does not trim space between forms when `:remove-multiple-non-indenting-spaces?` is missing"
    (is (= "(def foo
  (let [a   b
        aa bb
        ccc {:a b :aa bb :ccc ccc}]))"
           (:range-text (sut/format-text-at-idx {:eol      "\n"
                                                 :all-text misaligned-text
                                                 :range    [0 56]
                                                 :idxs     [1]}))))))

(def a-comment
  {:eol "\n"
   :all-text "  (foo)
(comment
  (defn bar
         [x]

baz))"
   :range [8 48]
   :idxs [47]
   :config {:keep-comment-forms-trail-paren-on-own-line? true
            :comment-form? true}})

(deftest format-text-w-comments-at-idx
  (is (= {:range-text "(comment
  (defn bar
    [x]

    baz))"}
         (select-keys (sut/format-text-at-idx
                       (assoc-in a-comment [:config :comment-form?] false))
                      [:range-text])))

  (is (= {:range-text "(comment
  (defn bar
    [x]

    baz)
  )"}
         (select-keys (sut/format-text-at-idx
                       (assoc a-comment :idxs [47]))
                      [:range-text]))))

(def first-top-level-text "
;; foo
(defn foo [x]
  (* x x))
 ")

(def mid-top-level-text ";; foo
(defn foo [x]
  (* x x))

(bar)")

(def last-top-level-text ";; foo
(defn foo [x]
  (* x x))
 ")

(deftest format-text-at-idx-on-type
  (is (= "(bar \n\n )"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(bar \n\n)" :range [0 8] :idxs [7]}))))
  (is (= "(bar \n\n ;;comment\n )"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(bar \n\n;;comment\n)" :range [0 18] :idxs [7]
                                                       :config {:cljfmt-options {:indent-line-comments? true}}}))))
  (is (= "(bar \n \n )"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(bar \n \n)" :range [0 9] :idxs [8]}))))
  (is (= "(bar \n \n )"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(bar \n\n)" :range [0 8] :idxs [6]}))))
  (testing "strings"
    (is (= "\"bar \n \n \""
           (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "\"bar \n \n \"" :range [0 10] :idxs [6]}))))
    (is (= "\"bar \n \n \""
           (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "\"bar \n \n \"" :range [0 10] :idxs [7]})))))
  (is (= "'([]\n    [])"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "  '([]\n[])" :range [2 10] :idxs [7]}))))
  (is (= "[:foo\n \n (foo) (bar)]"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "[:foo\n\n(foo)(bar)]" :range [0 18] :idxs [6]})))))

(deftest remove-indent-tokens
  (is (= {:range-text "foo\n\nbar"
         }
         (sut/remove-indent-tokens {:range-text "foo\n0\nbar"
                                    :indent-token "0"
                                    }))))

(deftest string-clojure-blank?
  (is (= true (sut/string-clojure-blank? "       ")))
  (is (= true (sut/string-clojure-blank? " , ")))
  (is (= false (sut/string-clojure-blank? "  foo  "))))

(deftest indent-before-range
  (is (= 10
         (sut/indent-before-range {:all-text "(def a 1)


(defn foo [x] (let [bar 1]

bar))" :range [22 25]})))
  (is (= 4
         (sut/indent-before-range {:all-text "  '([]
[])" :range [4 9]}))))

(deftest read-cljfmt
  (is (= {'a [[:inner 0]]}
         (:indents (sut/read-cljfmt "{:indents ^:replace {a [[:inner 0]]}}")))
      "with :replace metadata hint overrides default indents")
  (is (= true
         (:align-associative? (sut/read-cljfmt "{:align-associative? true}")))
      "including keys in cljfmt such as :align-associative? will override defaults.")
  (is (= false
         (:remove-surrounding-whitespace? (sut/read-cljfmt "{:remove-surrounding-whitespace? false}")))
      "including keys in cljfmt such as :remove-surrounding-whitespace? will override defaults.")
  (is (nil? (:foo (sut/read-cljfmt "{:bar false}")))
      "most keys don't have any defaults.")
  (is (zero?
       (count (:indents (sut/read-cljfmt "{}"))))
      "does not use default cljfmt indent rules"))

(deftest cljfmt-options
  (is (= {'a [[:inner 0]]}
         (:indents (sut/merge-default-config '{:indents ^:replace {a [[:inner 0]]}})))
      "with :replace metadata hint overrides default indents")
  (is (= true
         (:align-associative? (sut/merge-default-config {:align-associative? true
                                                         :cljfmt-string "{:align-associative? false}"})))
      "cljfmt :align-associative? has lower priority than config's option")
  (is (= false
         (:align-associative? (sut/merge-default-config {:cljfmt-string "{}"})))
      ":align-associative? is false by default")
  (is (nil? (:foo (sut/merge-default-config {:cljfmt-string "{:bar false}"})))
      "most keys don't have any defaults."))

(deftest convert-align-associative
  (testing "Converts :align-associative? to modern cljfmt options"
    (is (= {:align-map-columns? true
            :align-form-columns? true
            :split-keypairs-over-multiple-lines? true}
           (#'sut/convert-align-associative {:align-associative? true}))
        ":align-associative? true converts to alignment and split-keypairs options"))
  (testing "Does not convert when :align-associative? is false"
    (is (= {:align-associative? false}
           (#'sut/convert-align-associative {:align-associative? false}))
        ":align-associative? false is preserved"))
  (testing "Does not modify config without :align-associative?"
    (is (= {:foo :bar}
           (#'sut/convert-align-associative {:foo :bar}))
        "config without :align-associative? is unchanged")))
