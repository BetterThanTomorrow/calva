(ns calva.lsp.utilities
  (:require ["path" :as path]))

(defn get-clojure-lsp-path [extension-path windows-os?]
  (let [file-extension (when windows-os? ".exe")]
    (. path (join extension-path
                  (str "clojure-lsp" file-extension)))))