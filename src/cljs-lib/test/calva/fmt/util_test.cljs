(ns calva.fmt.util-test
  (:require [cljs.test :include-macros true :refer [deftest is]]
            [calva.fmt.util :as sut]))


#_(deftest log
    (is (= (with-out-str (sut/log {:range-text ""} :range-text))
           {:range-text ""})))


(def all-text "(def a 1)


(defn foo [x] (let [bar 1]

bar))")


(deftest current-line
  (is (= "(def a 1)" (sut/current-line all-text 0)))
  (is (= "(def a 1)" (sut/current-line all-text 4)))
  (is (= "(def a 1)" (sut/current-line all-text 9)))
  (is (= "" (sut/current-line all-text 10)))
  (is (= "" (sut/current-line all-text 11)))
  (is (= "(defn foo [x] (let [bar 1]" (sut/current-line all-text 12)))
  (is (= "(defn foo [x] (let [bar 1]" (sut/current-line all-text 27)))
  (is (= "(defn foo [x] (let [bar 1]" (sut/current-line all-text 38)))
  (is (= "" (sut/current-line all-text 39)))
  (is (= "bar))" (sut/current-line all-text (count all-text)))))


(deftest re-pos-one
  (is (= 6
         (sut/re-pos-first "\\s*x\\s*t$" "foo te x t")))
  (is (= 6
         (sut/re-pos-first "\\s*x\\s*t$" "foo te x t")))
  (is (= 5
         (sut/re-pos-first "\\s*e\\s*xt\\s*$" "foo te xt")))
  (is (= 173
         (sut/re-pos-first "\"\\s*#\\s*\"\\)$" "(create-state \"\"
                                 \"###  \"
                                 \"  ###\"
                                 \" ### \"
                                 \"  #  \")"))))


(deftest escape-regexp
  (is (= "\\.\\*"
         (sut/escape-regexp ".*"))))
