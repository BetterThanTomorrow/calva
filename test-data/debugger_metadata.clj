(ns debugger-metadata)

#dbg
 (defn test-metadata-symbol
   [x]
   (let [y x]
     ^{:hello "world"}
     (+ x ^{:inner "meta"} (+ 1 y))))

(defn test-metadata-symbol2
  [x]
  (let [y x]
    ^{:hello "world"}
    (+ x ^{:inner "meta"} (+ 1 #break y))))

(comment
  (test-metadata-symbol 42)
  (test-metadata-symbol2 42))