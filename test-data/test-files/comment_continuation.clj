(ns user)

(comment
  (defn all-is-not-lost []
    (let [dividend (->> [1 2 3]
                        (map inc)
                        (apply *)
              ;; foo
                        (+ 3))
          divisor 42]
      (/ dividend divisor)))
  (all-is-not-lost))