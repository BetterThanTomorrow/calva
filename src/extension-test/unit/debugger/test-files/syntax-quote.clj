;; 3, 2, 1, 2, 1, 2
(defn test-syntax-quote
  [y]
  `{:hello ~(+ 1 #break y|)})