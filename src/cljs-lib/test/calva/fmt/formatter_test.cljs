(ns calva.fmt.formatter-test
  (:require [cljs.test :include-macros true :refer [deftest is]]
            [calva.js-utils :refer [cljify]]
            [calva.fmt.formatter :as sut]))

(deftest format-text-at-range
  (is (= "(foo)\n(defn bar\n  [x]\n  baz)"
         (:range-text (sut/format-text-at-range {:eol "\n" :all-text "  (foo)\n(defn bar\n[x]\nbaz)" :range [2 26]})))))


(def all-text "  (foo)
  (defn bar
         [x]

baz)")


(deftest format-text-at-idx
  (is (= "(defn bar
    [x]

    baz)"
         (:range-text (sut/format-text-at-idx {:eol "\n" :all-text all-text :idx 11}))))
  (is (= 1
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text all-text :idx 11}))))
  (is (= [10 38]
         (:range (sut/format-text-at-idx {:eol "\n" :all-text all-text :idx 11})))))


(deftest new-index
  (is (= 1
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text all-text :idx 11}))))
  (is (= 13
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text all-text :idx 28}))))
  (is (= 10
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text all-text :idx 22}))))
  (is (= 12
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text all-text :idx 27}))))
  (is (= 22
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text all-text :idx 33}))))
  (is (= 5
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text "(defn \n  \nfoo)" :idx 6}))))
  (is (= 11
         (:new-index (sut/format-text-at-idx {:eol "\n" :all-text "(foo\n (bar)\n )" :idx 11})))))


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
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(bar \n\n)" :idx 7}))))
  (is (= "(bar \n \n )"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(bar \n \n)" :idx 8}))))
  (is (= "(bar \n \n )"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(bar \n\n)" :idx 6}))))
  (is (= "\"bar \n \n \""
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "\"bar \n \n \"" :idx 7}))))
  (is (= "\"bar \n \n \""
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "\"bar \n \n \"" :idx 7}))))
  (is (= "'([]\n    [])"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "  '([]\n[])" :idx 7}))))
  (is (= "[:foo\n \n (foo) (bar)]"
         (:range-text (sut/format-text-at-idx-on-type {:eol "\n" :all-text "[:foo\n\n(foo)(bar)]" :idx 6})))))


(deftest new-index-on-type
  (is (= 6
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn \n)" :idx 6}))))
  (is (= 8
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn\n\n)" :idx 6}))))
  #_(is (= 8 ;; Fails due to a bug in rewrite-cljs
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn\n\n#_)" :idx 6}))))
  (is (= 9
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn \n)" :idx 7}))))
  (is (= 7
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn \n  )" :idx 7}))))
  (is (= 9
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn \n  \n  )" :idx 9}))))
  (is (= 9
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn \n\n)" :idx 7}))))
  (is (= 10
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(defn \n\n)" :idx 8}))))
  (is (= 13
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "(foo\n (bar)\n)" :idx 12}))))
  (is (= 7
         (:new-index (sut/format-text-at-idx-on-type {:eol "\n" :all-text "[:foo\n\n(foo)(bar)]" :idx 6})))))


(deftest new-index-on-type-crlf
  (is (= 6
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(defn \r\n)" :idx 6}))))
  (is (= 10
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(defn \r\n)" :idx 8}))))
  (is (= 8
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(defn \r\n  )" :idx 8}))))
  (is (= 10
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(defn \r\n  \r\n  )" :idx 10}))))
  (is (= 10
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(defn \r\n\r\n)" :idx 8}))))
  (is (= 12
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(defn \r\n\r\n)" :idx 10}))))
  (is (= 15
         (:new-index (sut/format-text-at-idx-on-type {:eol "\r\n" :all-text "(foo\r\n (bar)\r\n)" :idx 14})))))
  

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


(def enclosing-range-text "(def a 1)


(defn foo [x] (let [bar 1]

bar))")


(deftest enclosing-range
  (is (= [22 25] ;"[x]"
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 23}))))
  (is (= [12 45] ;"enclosing form"
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 21}))))
  (is (= [0 9] ; after top level form
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 9}))))
  (is (= [0 9] ; before top level form
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 0}))))
  (is (= [26 44] ; before top level form
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 39}))))
  (is (= [10 10] ; void (between top level forms)
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 10}))))
  (is (= [5 5]
         (:range (sut/enclosing-range {:all-text "  []\n  \n[]" :idx 5}))))
  (is (= [1 7]
         (:range (sut/enclosing-range {:all-text " ([][])" :idx 4}))))
  #_(is (= [1 6]
         (:range (sut/enclosing-range {:all-text " (\"[\")" :idx 4}))))
  (is (= [1 12]
         (:range (sut/enclosing-range {:all-text " {:foo :bar}" :idx 2}))))
  (is (= [1 13]
         (:range (sut/enclosing-range {:all-text " #{:foo :bar}" :idx 8}))))
  (is (= [1 12]
         (:range (sut/enclosing-range {:all-text " '(:foo bar)" :idx 8})))))


(deftest enclosing-parent-range
  (is (= [12 45] ;"[x]" => enclosing defn
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 23
                                       :config {:calva-fmt/use-enclosing-parent? true}}))))
  (is (= [12 45] ;"enclosing top level defn"
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 21
                                       :config {:calva-fmt/use-enclosing-parent? true}}))))
  (is (= [0 9] ; after top level def form => selects it
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 9
                                       :config {:calva-fmt/use-enclosing-parent? true}}))))
  (is (= [0 9] ; before top level def form => selects it
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 0
                                       :config {:calva-fmt/use-enclosing-parent? true}}))))
  (is (= [26 44] ; inside let [bar 1] => selects let
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 33
                                       :config {:calva-fmt/use-enclosing-parent? true}}))))
  (is (= [12 45] ; inside let form => selects enclosing defn
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 31
                                       :config {:calva-fmt/use-enclosing-parent? true}}))))
  (is (= [10 10] ; void (between top level forms)
         (:range (sut/enclosing-range {:all-text enclosing-range-text :idx 10
                                       :config {:calva-fmt/use-enclosing-parent? true}}))))
  (is (= [5 5]
         (:range (sut/enclosing-range {:all-text "  []\n  \n[]" :idx 5
                                       :config {:calva-fmt/use-enclosing-parent? true}}))))
  (is (= [1 7] ; between the [][] => selects the enclosing list
         (:range (sut/enclosing-range {:all-text " ([][])" :idx 4
                                       :config {:calva-fmt/use-enclosing-parent? true}}))))
  (is (= [1 7] ; inside one of the [][] => selects the enclosing list
         (:range (sut/enclosing-range {:all-text " ([][])" :idx 3
                                       :config {:calva-fmt/use-enclosing-parent? true}}))))
  (is (= [2 4] ; inside one of the [][], parent false => selects the []
         (:range (sut/enclosing-range {:all-text " ([][])" :idx 3
                                       :config {:calva-fmt/use-enclosing-parent? false}}))))
  #_(is (= [1 6]
           (:range (sut/enclosing-range {:all-text " (\"[\")" :idx 4
                                         :config {:calva-fmt/use-enclosing-parent? true}}))))
  (is (= [1 12]
         (:range (sut/enclosing-range {:all-text " {:foo :bar}" :idx 2
                                       :config {:calva-fmt/use-enclosing-parent? true}})))))

(deftest convert-to-cljfmt-indents
  (is (= {}
         (sut/->cljfmt-indents (cljify #js {}))))
  (is (= {'a [[:inner 0]] 'b [[:block 1]]}
         (sut/->cljfmt-indents (cljify #js {"a" [["inner" 0]] "b" [["block" 1]]}))))
  (is (= {'foo/#bar->! [[:inner 0 1] [:block 2]]}
         (sut/->cljfmt-indents (cljify #js {"foo/#bar->!" [["inner" 0 1] ["block" 2]]})))))
