(ns calva.migration)

(defn jsify [o]
  (clj->js o))