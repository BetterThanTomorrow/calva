(ns workspace-activate
  (:require [db :as db]
            ["vscode" :as vscode]))

#_{:clj-kondo/ignore [:clojure-lsp/unused-public-var]}
(defn ws-root []
  (first vscode/workspace.workspaceFolders))

(swap! db/!state assoc :ws-activated? true)