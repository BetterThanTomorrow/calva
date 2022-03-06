(ns test)

(def hover-map
  {:stuff "in-here"
   :ohter "yeah"
   :deeper {:a 1, "foo" :bar, [1 2 3] (range 100)}})

(defn foo []
  (println "bar"))

(foo)