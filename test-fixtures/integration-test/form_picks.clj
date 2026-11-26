(ns form-picks)

(defn pick-me [x]
  (let [y (inc x)]
    {:a [1 2] :b (str y)}))
