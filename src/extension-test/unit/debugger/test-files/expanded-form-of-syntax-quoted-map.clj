;; 3, 2, 2, 1, 2, 1
(defn foo []
  (let [a "foo"
        b "bar"]
    (clojure.core/apply
     clojure.core/hash-map
     (clojure.core/seq
      (clojure.core/concat
       (clojure.core/list :a)
       (clojure.core/list #break a|)
       (clojure.core/list :b)
       (clojure.core/list b))))))