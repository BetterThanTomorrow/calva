(ns calva.js-utils-test
  (:require [cljs.test :refer [deftest is testing]]
            [calva.js-utils :refer [jsify]]))

(deftest jsify-test
  (testing "Converts map with vector containing map"
    (is (= (pr-str (jsify {:foo [1 {:bar :baz}]}))
           (pr-str #js {:foo #js [1 #js {:bar "baz"}]}))))
  (testing "Converts map with namespaced keywords"
    (is (= (pr-str (jsify {:foo/bar :foo/bar}))
           (pr-str #js {"foo/bar" "foo/bar"})))))