;; 3, "[1 (+ 1 2)]", 2
(defn test-map
  [x]
  {:hello "world" [1 (+ 1 2)] (+ 5 #break x|)})