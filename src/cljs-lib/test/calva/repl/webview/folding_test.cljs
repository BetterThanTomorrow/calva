(ns calva.repl.webview.folding-test
  (:require
   [calva.repl.webview.folding :as sut]
   [cljs.test :refer-macros [deftest is testing]]))

(defn- lines
  [n]
  (apply str (interpose "\n" (repeat n "x"))))

(deftest folded?-test
  (testing "a result over 5,000 characters is folded"
    (is (false? (sut/folded? (apply str (repeat 5000 "y")))))
    (is (true? (sut/folded? (apply str (repeat 5001 "y"))))))
  (testing "a result over 100 lines is folded"
    (is (false? (sut/folded? (lines 100))))
    (is (true? (sut/folded? (lines 101)))))
  (testing "only text folds"
    (is (false? (sut/folded? nil)))))

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
