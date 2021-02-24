(ns calva.pprint.printer-test
  (:require [cljs.test :refer [testing deftest is]]
            [calva.pprint.printer :refer [pretty-print]]
            [clojure.string :as str]))

(deftest pretty-print-test
  (letfn [(pretty-line-of [n s opts]
            (as-> `[~@(repeat n s)] x
              (pretty-print x opts)
              (:value x)
              (str/split x #"\n")
              (take 1 x)))]
    (let [deep [[[[[[[[[[[[[[[[[{:foo [:bar]}]]]]]]]]]]]]]]]]]
          shallow [[:foo]]]
      (testing "String input"
        (is (= "[[[:foo]]]"
               (:value (pretty-print "[    [ [:foo
                      ]]        ]" nil)))))
      (testing "Valid and invalid EDN"
        (is (= "[1]"
               (:value (pretty-print "[   1]" nil))))
        (is (= "[  1"
               (:value (pretty-print "[  1" nil)))))
      (testing "Default printing options" ; zprint default width 80
        (let [width (apply count (pretty-line-of 25 "foo" nil))]
          (is (> width 70))
          (is (<= width 80)))
        (is (not (re-find #"#" (:value (pretty-print deep nil))))))
      (testing "Settings"
        (let [width (apply count (pretty-line-of 25 "foo" {:width 40}))]
          (is (> width 30))
          (is (<= width 40)))
        (let [width (apply count (pretty-line-of 25 "foo" {:max-length 2}))]
          (is (< width 20)))
        (is (re-find #"#" (:value (pretty-print shallow {:max-depth 1}))))))))