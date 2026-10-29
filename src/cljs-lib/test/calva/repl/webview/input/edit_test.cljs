(ns calva.repl.webview.input.edit-test
  (:require
   [calva.repl.webview.input.edit :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest text-change-test
  (testing "the smallest change that turns one text into the other"
    (is (= {:from 4 :to 4 :insert " c"} (sut/text-change "(a b)" "(a b c)")))
    (is (= {:from 1 :to 2 :insert ""} (sut/text-change "(a b)" "( b)")))
    (is (= {:from 0 :to 3 :insert ""} (sut/text-change "abc" "")))
    (is (= {:from 2 :to 3 :insert ""} (sut/text-change "aaa" "aa"))))
  (testing "no change for the same text"
    (is (nil? (sut/text-change "(a b)" "(a b)")))))
