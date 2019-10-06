(ns  calva.inspector
  "Utilities for supporting Calva's inspection of data structures."
  (:require [calva.js-utils :refer [jsify parse-edn]]))

(defn- inspector-annotate
  "Recursively annotates ClojureScript values with .
  sets/vectors/lists become Arrays, Keywords and Symbol become Strings,
  Maps become Objects. Arbitrary keys are encoded to by `inspector-key->js`."
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
      (inspector-annotate)
      (jsify)))

(comment
  (map (fn [[k v]] [k (inc v)]) (seq {:foo 1 :bar 2}))
  (into {} (for [[k v] (seq {:foo 1 :bar 2})] [k (inc v)])) 
  (clj->js (inspector-annotate {:foo (vec (repeat 3 :empty))}))
  (clj->js (inspector-annotate [1 2 3 4 5]))
  (clj->js (inspector-annotate #([1 2 3 4 5])))
  (clj->js (inspector-annotate {:foo 1 :bar ["a", "b", "c"]}))
  (clj->js (inspector-annotate (def s [1 2 3 4 5]))))