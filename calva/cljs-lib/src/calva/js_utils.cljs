(ns calva.js-utils)

(defn ^:export jsify [o]
  (clj->js o))

(defn ^:export cljify [o]
  (js->clj o :keywordize-keys true))