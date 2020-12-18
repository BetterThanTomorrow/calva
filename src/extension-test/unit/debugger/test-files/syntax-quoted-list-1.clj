;; 3, 1, 1
(defn fooz [x y]
  `(#break :x| ~x :y ~y))

(comment
  "Expanded form"
  (defn fooz [x y]
    (clojure.core/seq
     (clojure.core/concat
      (clojure.core/list :x)
      (clojure.core/list x)
      (clojure.core/list :y)
      (clojure.core/list y)))))