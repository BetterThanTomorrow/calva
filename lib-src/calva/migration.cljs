(ns calva.migration)


(defn ^:export jsify [o]
  (clj->js o))


(defn ^:export cljify [o]
  (js->clj o :keywordize-keys true))
