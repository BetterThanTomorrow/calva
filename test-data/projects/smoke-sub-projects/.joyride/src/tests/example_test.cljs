(ns tests.example-test
  (:require [cljs.test :refer [deftest testing is]]
            [promesa.core :as p]
            [macros :refer [deftest-async]]))

(deftest a-sync-test
  (testing "A sync test"
    (is (not= nil? 1))))

(deftest-async an-async-test
  (testing "Requires the Joyride extension"
    (p/let [answer (p/resolved 42)]
      (is (= 42 answer)))))
