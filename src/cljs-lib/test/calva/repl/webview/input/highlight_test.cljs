(ns calva.repl.webview.input.highlight-test
  (:require
   [calva.repl.webview.input.highlight :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest typed-quote-test
  (let [text "(str \"ab \\\" cd\" x)"]
    (testing "steps over the quote that closes the string"
      (is (= :step-over (sut/typed-quote text 14))))
    (testing "inserts the quote alone elsewhere in a string"
      (is (= :insert (sut/typed-quote text 6)))
      (is (= :insert (sut/typed-quote text 9))))
    (testing "leaves quotes outside strings to bracket closing"
      (is (nil? (sut/typed-quote text 15)))
      (is (nil? (sut/typed-quote text 1)))))
  (testing "leaves quotes in comments and character literals out of strings"
    (is (nil? (sut/typed-quote "; \"a\n(x)" 3)))
    (is (nil? (sut/typed-quote "[\\\" x]" 4)))
    (is (= :step-over (sut/typed-quote "[\\\" \"a\"]" 6))))
  (testing "inserts the quote alone in a string that doesn't close"
    (is (= :insert (sut/typed-quote "(str \"ab" 7)))))

(deftest string-ranges-test
  (is (= [[1 4] [6 10]] (sut/string-ranges "(\"a\" #\"\\d\")"))
      "Strings and regular expressions, an escaped character in one"))

(deftest layered-test
  (testing "puts the semantic ranges over the grammar ranges, as runs of one color"
    (is (= [[0 2 "#a" nil] [2 4 "#b" nil] [4 6 "#a" nil]]
           (sut/layered [[0 6 "#a" nil]] [[2 4 "#b" nil]]))))
  (testing "leaves out what has no color, and joins neighbors of one color"
    (is (= [[1 3 "#a" nil] [5 6 "#b" nil]]
           (sut/layered [[1 2 "#a" nil] [2 3 "#a" nil]] [[5 6 "#b" nil]]))))
  (testing "sets and unsets the grammar's font styles with the semantic ranges', keeping the grammar's color where they have none"
    (is (= [[0 1 "#a" #{:italic}] [1 2 "#a" #{:bold}] [2 3 nil #{:bold}]]
           (sut/layered [[0 2 "#a" #{:italic}] [2 3 nil #{:italic}]] [[1 3 nil {:italic false :bold true}]]))))
  (testing "returns no runs without ranges"
    (is (= [] (sut/layered nil nil)))))

(deftest mapped-test
  (let [insert-at-2 (fn [pos _assoc] (if (>= pos 2) (+ pos 3) pos))]
    (testing "moves the ranges after an insertion, with their colors and font styles"
      (is (= [[0 1 "#a" nil] [5 7 "#b" #{:italic}]] (sut/mapped [[0 1 "#a" nil] [2 4 "#b" #{:italic}]] insert-at-2)))))
  (testing "drops the ranges a deletion empties"
    (is (= [[0 1 "#a" nil]] (sut/mapped [[0 1 "#a" nil] [2 4 "#b" nil]] (fn [pos _assoc] (min pos 2)))))))

