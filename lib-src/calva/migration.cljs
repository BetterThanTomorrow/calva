(ns calva.migration)


(defn jsify [o]
  (clj->js o))


(defn cljify [o]
  (js->clj o :keywordize-keys true))
