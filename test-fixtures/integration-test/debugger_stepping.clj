(ns debugger-stepping)

(defn g [x]
  (let [y (inc x)]
    (* y 2)))
