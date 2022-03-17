;; 3, 2, 2, 2
(defn test-metadata-symbol
  [x]
  (let [y x]
    ^{:hello "world"}
    (+ x ^{:inner "meta"} (+ 1 #break y|))))