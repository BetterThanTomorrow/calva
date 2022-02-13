(ns pez-rewrite-clj.zip.editz-test
  (:require [cljs.test :refer-macros [deftest is testing run-tests]]
            [pez-rewrite-clj.zip :as z]
            [pez-rewrite-clj.node :as n]
            [pez-rewrite-clj.zip.editz :as e]))



(deftest splice
  (is (= "[1 2 [3 4]]" (-> "[[1 2] [3 4]]"
                           z/of-string
                           z/down
                           e/splice
                           z/root-string))))
