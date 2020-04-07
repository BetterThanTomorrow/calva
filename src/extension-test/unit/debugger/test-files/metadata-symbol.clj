;; 3, 2, 2
(defn test-metadata-symbol
  [x]
  (let [y x]
    (+ ^String x #break ^String y|)))