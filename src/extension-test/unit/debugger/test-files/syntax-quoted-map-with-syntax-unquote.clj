;; 3, 2, 2, 1, 2, 1
(defn foo []
  (let [a "foo"
        b "bar"]
    `{:a #break ~a| :b ~b}))