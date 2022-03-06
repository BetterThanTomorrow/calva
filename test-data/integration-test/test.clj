(ns test)

(defn foo []
  (println "bar"))

(foo)

(def hover-map
  {:stuff "in-here"
   :ohter "yeah"
   :deeper {:a 1, "foo" :bar, [1 2 3] (range 1)}})