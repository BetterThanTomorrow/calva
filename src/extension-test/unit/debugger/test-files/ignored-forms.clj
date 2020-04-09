;; 3, 1, 1
(defn test-ignore
  [x]
  (let [y #_#_#_2 3 4 #break x|]
    (+ x y)))