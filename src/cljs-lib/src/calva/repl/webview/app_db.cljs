(ns calva.repl.webview.app-db)

(def initial-db
  {:output/last-context nil})

(defonce !app-db (atom initial-db))

(defn set-last-context
  [db context]
  (assoc db :output/last-context context))

(defn clear-last-context
  [db]
  (assoc db :output/last-context nil))
