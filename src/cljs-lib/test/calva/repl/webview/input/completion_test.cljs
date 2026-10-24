(ns calva.repl.webview.input.completion-test
  (:require
   [calva.repl.webview.input.completion :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest word-start
  (testing "the start of the word before the cursor, the way Calva finds words"
    (is (= 1 (sut/word-start "(string/upp)" 11)))
    (is (= 5 (sut/word-start "(foo :bar" 9)))
    (is (= 8 (sut/word-start "(deref @atom" 12))))
  (testing "after a leading syntax quote"
    (is (= 2 (sut/word-start "(`foo" 5))))
  (testing "the cursor when no word ends there"
    (is (= 1 (sut/word-start "( " 1)))
    (is (= 0 (sut/word-start "" 0)))))

(deftest valid-for?
  (is (true? (sut/valid-for? "string/up" "string/upper"))
      "Typing on narrows the candidates")
  (is (false? (sut/valid-for? "string" "string/u"))
      "A namespace separator asks again")
  (is (false? (sut/valid-for? "java" "java.l"))
      "A member separator asks again")
  (is (false? (sut/valid-for? "str" "st"))
      "Deleting into the prefix asks again"))

(deftest restart?
  (let [restart {:request 3 :from 1 :prefix "str" :options []}]
    (is (true? (sut/restart? restart "(stri)" 1 5))
        "The final answer fits the word the list shows")
    (is (false? (sut/restart? restart "(x stri)" 3 7))
        "Not for a word somewhere else")
    (is (false? (sut/restart? nil "(stri)" 1 5))
        "Not without a final answer")))

(deftest doc-blocks
  (is (= [[:code "(upper-case s)"] [:text "Converts string to all upper-case."]]
         (sut/doc-blocks "```clojure\n(upper-case s)\n```\n\nConverts string to all upper-case.\n"))
      "Fenced code, then text")
  (is (= [[:text "Returns its argument."]]
         (sut/doc-blocks "Returns its argument."))
      "Text without fences"))
