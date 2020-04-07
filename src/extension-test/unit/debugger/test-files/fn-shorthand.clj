;; 3, 1, 2, 2
(defn fn-shorthand
  [s x]
  (filter #(= % #break x|) s))