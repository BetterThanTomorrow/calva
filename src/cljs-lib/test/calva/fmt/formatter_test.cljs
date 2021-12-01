(ns calva.fmt.formatter-test
  (:require [cljs.test :include-macros true :refer [deftest is]]
            [cljfmt.core :as cljfmt]
            [calva.fmt.formatter :as sut]))

(deftest format-text-at-range
  (is (= "(foo)\n(defn bar\n  [x]\n  baz)"
         (:range-text (sut/format-text-at-range {:eol "\n" :all-text "  (foo)\n(defn bar\n[x]\nbaz)" :range [2 26]}))))
  (is (not (contains? (sut/format-text-at-range {:eol "\n" :all-text "  (foo)\n(defn bar\n[x]\nbaz)" :range [2 26]}) :new-index))))

(def all-text "  (foo)
  (defn bar
         [x]

baz)")

(deftest format-text-at-idx
  (is (= "(defn bar
    [x]

    baz)"
         (:range-text (sut/format-text-at-idx {:eol "\n" :all-text all-text :range [10 38] :idx 11}))))
  (is (= 1
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text all-text :range [10 38] :idx 11}))))
  (is (= [10 38]
         (:range (sut/format-text-at-idx {:eol "\n" :all-text all-text :range [10 38] :idx 11}))))
  (is (= [0 5]
         (:range (sut/format-text-at-idx {:eol "\n" :all-text "(\n\n,)" :range [0 5] :idx 2}))))
  (is (= "()"
         (:range-text (sut/format-text-at-idx {:eol "\n" :all-text "(\n\n,)" :range [0 5] :idx 2})))))

(def a-comment
  {:eol "\n"
   :all-text "  (foo)
(comment
  (defn bar
         [x]

baz))"
   :range [8 48]
   :idx 47
   :config {:keep-comment-forms-trail-paren-on-own-line? true
            :comment-form? true}})

(deftest format-text-w-comments-at-idx
  (is (= {:new-index 38
          :range-text "(comment
  (defn bar
    [x]

    baz))"}
         (select-keys (sut/format-text-at-idx
                       (assoc-in a-comment [:config :comment-form?] false))
                      [:range-text :new-index])))

  (is (= {:new-index 41
          :range-text "(comment
  (defn bar
    [x]

    baz)
  )"}
         (select-keys (sut/format-text-at-idx
                       (assoc a-comment :idx 47))
                      [:range-text :new-index]))))

(deftest new-index
  (is (= 1
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text all-text :range [10 38] :idx 11}))))
  (is (= 13
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text all-text :range [10 38] :idx 28}))))
  (is (= 10
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text all-text :range [10 38] :idx 22}))))
  (is (= 12
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text all-text :range [10 38] :idx 27}))))
  (is (= 22
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text all-text :range [10 38] :idx 33}))))
  (is (= 5
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text "(defn \n  \nfoo)" :range [0 14] :idx 6}))))
  (is (= 11
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text "(foo\n (bar)\n )" :range [0 14] :idx 11}))))
  (is (= 1
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text "(\n\n,)" :range [0 14] :idx 2})))))


(def head-and-tail-text "(def a 1)


(defn foo [x] (let [bar 1]

bar))")


(deftest add-head-and-tail
  (is (= {:head "" :tail head-and-tail-text
          :all-text head-and-tail-text
          :idx 0}
         (sut/add-head-and-tail {:all-text head-and-tail-text :idx 0})))
  (is (= {:head head-and-tail-text :tail ""
          :all-text head-and-tail-text
          :idx (count head-and-tail-text)}
         (sut/add-head-and-tail {:all-text head-and-tail-text :idx (count head-and-tail-text)})))
  (is (= {:head "(def a 1)\n\n\n(defn foo "
          :tail "[x] (let [bar 1]\n\nbar))"
          :all-text head-and-tail-text
          :idx 22}
         (sut/add-head-and-tail {:all-text head-and-tail-text :idx 22})))
  (is (= {:head head-and-tail-text :tail ""
          :all-text head-and-tail-text
          :idx (inc (count head-and-tail-text))}
         (sut/add-head-and-tail {:all-text head-and-tail-text :idx (inc (count head-and-tail-text))}))))


(deftest normalize-indents
  (is (= "(foo)\n  (defn bar\n    [x]\n    baz)"
         (:range-text (sut/normalize-indents {:eol "\n"
                                              :all-text "  (foo)\n(defn bar\n[x]\nbaz)"
                                              :range [2 26]
                                              :range-text "(foo)\n(defn bar\n  [x]\n  baz)"})))))


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
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(bar \n\n)" :range [0 8] :idx 7}))))
  (is (= "(bar \n \n )"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(bar \n \n)" :range [0 9] :idx 8}))))
  (is (= "(bar \n \n )"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(bar \n\n)" :range [0 8] :idx 6}))))
  (is (= "\"bar \n \n \""
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "\"bar \n \n \"" :range [0 10] :idx 7}))))
  (is (= "\"bar \n \n \""
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "\"bar \n \n \"" :range [0 10] :idx 7}))))
  (is (= "'([]\n    [])"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "  '([]\n[])" :range [2 10] :idx 7}))))
  (is (= "[:foo\n \n (foo)(bar)]"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "[:foo\n\n(foo)(bar)]" :range [0 18] :idx 6})))))


(deftest new-index-on-type
  (is (= 6
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn \n)" :range [0 8] :idx 6}))))
  (is (= 8
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn\n\n)" :range [0 8] :idx 6}))))
  #_(is (= 8 ;; Fails due to a bug in rewrite-cljs
           (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn\n\n#_)" :range [0 10] :idx 6}))))
  (is (= 9
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn \n)" :range [0 8] :idx 7}))))
  (is (= 7
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn \n  )" :range [0 10] :idx 7}))))
  (is (= 9
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn \n  \n  )" :range [0 13] :idx 9}))))
  (is (= 9
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn \n\n)" :range [0 9] :idx 7}))))
  (is (= 10
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn \n\n)" :range [0 9] :idx 8}))))
  (is (= 13
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(foo\n (bar)\n)" :range [0 13] :idx 12}))))
  (is (= 7
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "[:foo\n\n(foo)(bar)]" :range [0 18] :idx 6})))))


(deftest new-index-on-type-crlf
  (is (= 6
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(defn \r\n)" :range [0 9] :idx 6}))))
  (is (= 10
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(defn \r\n)" :range [0 9] :idx 8}))))
  (is (= 8
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(defn \r\n  )" :range [0 11] :idx 8}))))
  (is (= 10
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(defn \r\n  \r\n  )" :range [0 15] :idx 10}))))
  (is (= 10
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(defn \r\n\r\n)" :range [0 11] :idx 8}))))
  (is (= 12
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(defn \r\n\r\n)" :range [0 11] :idx 10}))))
  (is (= 15
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(foo\r\n (bar)\r\n)" :range [0 15] :idx 14})))))


(deftest index-for-tail-in-range
  (is (= 7
         (:new-index (sut/index-for-tail-in-range
                      {:range-text "foo te    x t"
                       :range-tail "   x t"}))))
  (is (= 169
         (:new-index (sut/index-for-tail-in-range
                      {:range-text "(create-state \"\"
                                \"###  \"
                                \"  ###\"
                                \" ### \"
                                \"  #  \")"
                       :range-tail "\"  #  \")"})))))


(deftest remove-indent-token-if-empty-current-line
  (is (= {:range-text "foo\n\nbar"
          :range [4 4]
          :current-line ""
          :new-index 4}
         (sut/remove-indent-token-if-empty-current-line {:range-text "foo\n0\nbar"
                                                         :range [4 5]
                                                         :new-index 4
                                                         :current-line ""})))
  (is (= {:range-text "foo\n0\nbar"
          :range [4 5]
          :current-line "0"
          :new-index 4}
         (sut/remove-indent-token-if-empty-current-line {:range-text "foo\n0\nbar"
                                                         :range [4 5]
                                                         :new-index 4
                                                         :current-line "0"}))))


(deftest current-line-empty?
  (is (= true (sut/current-line-empty? {:current-line "       "})))
  (is (= false (sut/current-line-empty? {:current-line "  foo  "}))))


(deftest indent-before-range
  (is (= 10
         (sut/indent-before-range {:all-text "(def a 1)


(defn foo [x] (let [bar 1]

bar))" :range [22 25]})))
  (is (= 4
         (sut/indent-before-range {:all-text "  '([]
[])" :range [4 9]}))))


(deftest read-cljfmt
  (is (= (count cljfmt/default-indents)
         (count (:indents (sut/read-cljfmt "{}"))))
      "by default uses cljfmt indent rules")
  (is (= (+ 2 (count cljfmt/default-indents))
         (count (:indents (sut/read-cljfmt "{:indents {foo [[:inner 0]] bar [[:block 1]]}}"))))
      "merges indents on top of cljfmt indent rules")
  (is (= {'a [[:inner 0]]}
         (:indents (sut/read-cljfmt "{:indents ^:replace {a [[:inner 0]]}}")))
      "with :replace metadata hint overrides default indents")
  (is (= false
         (:align-associative? (sut/read-cljfmt "{}")))
      ":align-associative? is false by default.")
  (is (= true
         (:align-associative? (sut/read-cljfmt "{:align-associative? true}")))
      "including keys in cljfmt such as :align-associative? will override defaults.")
  (is (= true
         (:remove-surrounding-whitespace? (sut/read-cljfmt "{}")))
      ":remove-surrounding-whitespace? is true by default.")
  (is (= false
         (:remove-surrounding-whitespace? (sut/read-cljfmt "{:remove-surrounding-whitespace? false}")))
      "including keys in cljfmt such as :remove-surrounding-whitespace? will override defaults.")
  (is (nil? (:foo (sut/read-cljfmt "{:bar false}")))
      "most keys don't have any defaults."))

(deftest cljfmt-options
  (is (= (count cljfmt/default-indents)
         (count (:indents (sut/cljfmt-options {}))))
      "by default uses cljfmt indent rules")
  (is (= (+ 2 (count cljfmt/default-indents))
         (count (:indents (sut/cljfmt-options {:cljfmt-string "{:indents {foo [[:inner 0]] bar [[:block 1]]}}"}))))
      "merges indents on top of cljfmt indent rules")
  (is (= {'a [[:inner 0]]}
         (:indents (sut/cljfmt-options {:cljfmt-string "{:indents ^:replace {a [[:inner 0]]}}"})))
      "with :replace metadata hint overrides default indents")
  (is (= true
         (:align-associative? (sut/cljfmt-options {:align-associative? true
                                                   :cljfmt-string "{:align-associative? false}"})))
      "cljfmt :align-associative? has lower priority than config's option")
  (is (= false
         (:align-associative? (sut/cljfmt-options {:cljfmt-string "{}"})))
      ":align-associative? is false by default")
  (is (nil? (:foo (sut/read-cljfmt {:cljfmt-string "{:bar false}"})))
      "most keys don't have any defaults."))
