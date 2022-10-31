(ns foo-test
  (:require [clojure.test :refer [deftest testing is]]
            [foo :as sut]))

(deftest foo
  (testing "The foo"
    (is (= :foo (sut/foo)))))

(deftest bar
  (testing "The bar"
    (is (= :baz (sut/bar)))))

(deftest boom
  (testing "The boom"
    (is (= :boom (/ 1 0)))))