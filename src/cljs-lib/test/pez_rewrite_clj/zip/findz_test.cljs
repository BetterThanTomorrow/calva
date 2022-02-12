(ns pez-rewrite-clj.zip.findz-test
  (:require [cljs.test :refer-macros [deftest is testing run-tests]]
            [pez-rewrite-clj.zip :as z]
            [pez-rewrite-clj.node :as n]
            [pez-rewrite-clj.zip.findz :as f]))



(deftest find-last-by-pos
  (is (= "2" (-> "[1 2 3]"
                 z/of-string
                 (f/find-last-by-pos {:row 1 :col 4} (constantly true))
                 z/string))))

(deftest find-last-by-pos-when-whitespace
  (is (= " " (-> "[1 2 3]"
                 z/of-string
                 (f/find-last-by-pos {:row 1 :col 3} (constantly true))
                 z/string))))


(deftest find-last-by-pos-multiline
  (let [sample "
{:a 1
 :b 2}" ]
    (is (= ":a" (-> sample
                    z/of-string
                    (f/find-last-by-pos {:row 2 :col 2})
                    z/string)))
    (is (= "1"  (-> sample
                    z/of-string
                    (f/find-last-by-pos {:row 2 :col 5})
                    z/string)))))

(deftest find-tag-by-pos
  (is (= "[4 5 6]" (-> "[1 2 3 [4 5 6]]"
                       z/of-string
                       (f/find-tag-by-pos {:row 1 :col 8} :vector)
                       z/string))))


(deftest find-tag-by-pos-set
  (is (= "#{4 5 6}" (-> "[1 2 3 #{4 5 6}]"
                       z/of-string
                       (f/find-tag-by-pos {:row 1 :col 10} :set)
                       z/string))))
