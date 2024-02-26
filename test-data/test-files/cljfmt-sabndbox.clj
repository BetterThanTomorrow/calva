[:/
 [:a "iuna"]
 [:b "urina"]]

(def foo
  (let [a b
        aa bb
        ccc {:a b :aa bb :ccc ccc}]))

(tabular 0
  (foo
    (bar
     0)))

(f
 ##Inf)

(let [[time id] (->> (range init-time ##Inf)
                     (some time-id-now))]
  (println (* (- time init-time) id)))

(let [start 0
      [max-i max-id] (apply max-key second ids)
      offset (+ max-i (rem start max-id))]
  (->>
   (range (- start offset) max-id)
   (filter all-ordered?)
   (first)
   (println)))

(let {^String x       "foo"
      some-longer-var "bar"})

(comment)

