(ns pez-rewrite-clj.zip.seqz-test
  (:require [cljs.test :refer-macros [deftest is testing run-tests]]
            [pez-rewrite-clj.zip :as z]
            [pez-rewrite-clj.node :as n]
            [pez-rewrite-clj.zip.seqz :as seqz]))



(deftest check-predicates
  (is (-> "[1 2 3]" z/of-string z/vector?))
  (is (-> "{:a 1}" z/of-string z/map?))
  (is (-> "#{1 2}" z/of-string z/set?))
  (is (-> "(+ 2 3)" z/of-string z/list?))
  (is (-> "[1 2]" z/of-string z/seq?)))

(deftest get-from-map
  (is (= 1 (-> "{:a 1}" z/of-string (z/get :a) z/node :value))))

(deftest get-from-vector
  (is (= 10 (-> "[5 10 15]" z/of-string (z/get 1) z/node :value))))

(deftest get-from-vector-index-out-of-bounds
  (is (thrown-with-msg? js/Error #"Index out of bounds"
                        (-> "[5 10 15]" z/of-string (z/get 5) z/node :value))))

(deftest map-on-vector
  (let [sexpr "[1\n2\n3]"
        expected "[5\n6\n7]"]
    (is (= expected (->> sexpr z/of-string (z/map #(z/edit % + 4)) z/root-string)))))


(deftest assoc-on-map
  (is (contains? (-> "{:a 1}" z/of-string (z/assoc :b 2) z/node n/sexpr) :b)))
