(ns calva.repl.webview.folding-test
  (:require
   [calva.repl.webview.folding :as sut]
   [cljs.test :refer-macros [deftest is testing]]))

(deftest folded?-test
  (testing "a result longer than the setting's characters is folded"
    (is (false? (sut/folded? (apply str (repeat 5000 "y")) 5000)))
    (is (true? (sut/folded? (apply str (repeat 5001 "y")) 5000))))
  (testing "lines don't count"
    (is (false? (sut/folded? (apply str (interpose "\n" (repeat 1000 "x"))) 5000))))
  (testing "0 turns folding off"
    (is (false? (sut/folded? (apply str (repeat 5001 "y")) 0))))
  (testing "only text folds"
    (is (false? (sut/folded? nil 5000)))))

(deftest start-test
  (testing "the start of the first line"
    (is (= "[{:id 0}" (sut/start "[{:id 0}\n {:id 1}]"))))
  (testing "a long first line is cut, and says so"
    (is (= (str (apply str (repeat 100 "y")) "…") (sut/start (apply str (repeat 300 "y")))))))

(deftest size-text-test
  (is (= "52,341 characters, 1,500 lines" (sut/size-text 52341 1500)))
  (is (= "6,000 characters, 1 line" (sut/size-text 6000 1))))

(deftest text-size-test
  (is (= [10 3] (sut/text-size "ab\ncd\nefgh")) "Characters and lines"))
