;; 3, 2, 2, 2
#dbg
 (defn test-metadata-symbol
   [x]
   (let [y x]
     ^{:hello "world"}
     (+ x ^{:inner "meta"} (+ 1 y|))))