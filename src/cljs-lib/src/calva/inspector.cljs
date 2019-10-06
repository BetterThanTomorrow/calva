(ns  calva.inspector
  "Utilities for supporting Calva's inspection of data structures."
  (:require [calva.js-utils :refer [jsify parse-edn]]))

(defn- annotate
  "Recursively annotates ClojureScript values with Clojure data type information.
  Sets/vectors/lists become arrays, keywords and symbol become strings. Maps become
  objects. All these are wrapped in objects containing `type` and `value`.
  Values that map to JavaScript primitives are not annotated."
  [x]
  (letfn [(thisfn [x]
            (cond
              (keyword? x) {:type "keyword" :value (name x)}
              (symbol? x) {:type "symbol" :value (str x)}
              (map? x) {:type "map" :value (into {} (for [[k v] x] [k (thisfn v)]))}
              (coll? x) (let [type (cond
                                     (vector? x) "vector"
                                     (list? x) "list"
                                     (set? x) "set"
                                     :else "coll")]
                          {:type type :value (map thisfn x)})
              :else x))]
    (thisfn x)))

(defn inspect
  "Reads the string `s`, which should be a string containing a Clojure form,
   and returns it js-ified as either:
   * The single value, if the form parses to a JS primitive, (number, string etcetera)
   * An object annotated with Clojure types"
  [s]
  (-> s
      (parse-edn)
      (annotate)
      (jsify)))

(comment
  (map (fn [[k v]] [k (inc v)]) (seq {:foo 1 :bar 2}))
  (into {} (for [[k v] (seq {:foo 1 :bar 2})] [k (inc v)])) 
  (clj->js (annotate {:foo (vec (repeat 3 :empty))}))
  (clj->js (annotate [1 2 3 4 5]))
  (clj->js (annotate #([1 2 3 4 5])))
  (clj->js (annotate {:foo 1 :bar ["a", "b", "c"]}))
  (clj->js (annotate (def s [1 2 3 4 5]))))