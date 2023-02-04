(ns tests.a-test
  (:require [cljs.test :refer [deftest testing is]]
            [promesa.core :as p]
            ["ext://betterthantomorrow.joyride" :as joyride]
            ["ext://betterthantomorrow.calva$v0" :as calva]
            [macros :refer [deftest-async]]))

(deftest calva-required
  (testing "Requires Calva"
    (is (not= nil? calva/ranges))))

(deftest-async joyride-required
  (testing "Requires the Joyride extension"
    (p/let [question (joyride/runCode "42")]
      (is (= 42 question)))))
