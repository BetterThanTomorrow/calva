(ns calva.js-utils
  (:require [cljs.reader]))

(defn jsify
  "Converts clojure data to js data"
  [o]
  (clj->js o :keyword-fn (fn [kw] (str (symbol kw)))))

(defn cljify [o]
  (js->clj o :keywordize-keys true))

