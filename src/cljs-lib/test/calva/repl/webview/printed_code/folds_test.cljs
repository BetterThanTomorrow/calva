(ns calva.repl.webview.printed-code.folds-test
  (:require
   [calva.repl.webview.printed-code.folds :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

;; The painter's brackets of this text, as the extension posts them
(def text "{:a [1\n     2]\n :b #{3}\n :c (f\n    (g))}")

(def brackets
  [[0 1 0] [4 5 1] [13 14 1] [19 21 1] [22 23 1] [28 29 1] [35 36 2] [37 38 2] [38 39 1] [39 40 0]])

(deftest forms-test
  (testing "the text between the brackets of each form, in the order the forms open"
    (is (= [[1 39] [5 13] [21 22] [29 38] [36 37]]
           (sut/forms text brackets))))
  (testing "a close bracket without an open one is left out"
    (is (= [[1 2]] (sut/forms "(a))" [[0 1 0] [2 3 0] [3 4 0]]))))
  (testing "no brackets, no forms"
    (is (= [] (sut/forms "a" nil)))))

(deftest outermost-form-test
  (is (= [1 39] (sut/outermost-form text))
      "A map")
  (is (= [3 7] (sut/outermost-form "\n#{1\n 2}\n"))
      "A set, with whitespace around it")
  (is (nil? (sut/outermost-form "{:a 1} {:b 2"))
      "Text that doesn't end with the close bracket of its first")
  (is (nil? (sut/outermost-form "\"{a\n}\""))
      "A string"))

(deftest fold-at-test
  (let [forms (sut/forms text brackets)]
    (is (= [1 39] (sut/fold-at forms 0 6))
        "The first line folds the outermost form that opens on it")
    (is (nil? (sut/fold-at forms 7 14))
        "A line where no form opens has no fold")
    (is (nil? (sut/fold-at forms 15 23))
        "A form that closes on its own line doesn't fold")
    (is (= [29 38] (sut/fold-at forms 24 30))
        "A form that opens at the end of a line folds")
    (is (nil? (sut/fold-at forms 31 40))
        "The last line has no fold")))
