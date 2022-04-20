(ns calva.js2cljs.converter-test
  (:require [calva.js2cljs.converter :as sut]
            [clojure.spec.alpha :as s]
            [cljs.test :refer [testing deftest is]]))

;; valid result
(s/def ::result string?)

;; invalid result
(s/def ::message string?)
(s/def ::number-of-parsed-lines pos-int?)
(s/def ::name string?)
(s/def ::exception (s/keys :req-un [::name ::message]))
(s/def ::error (s/keys :req-un [::message ::number-of-parsed-lines ::exception]))
(s/def ::invalid-result (s/keys :req-un [::error]))

(deftest valid-results-test
  (testing "Returns a map with a `:result` string entry when conversion succeeds"
    (is (s/valid? ::result (:result (sut/convert "foo"))))))

(deftest invalid-results-test
  (testing "Returns a map with an `:error` entry when conversion fails"
    (is (s/valid? ::invalid-result (sut/convert "import * as foo from 'foo';")))))