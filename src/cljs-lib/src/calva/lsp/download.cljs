(ns calva.lsp.download)

(defn configured-version-exists?
  "Check if the version configured in Calva "
  [current-version version-output])

(defn download-clojure-lsp [version file-path]
  (let [url-path (str "/clojure-lsp/clojure-lsp/releases/download/"
                      version
                      "/clojure-lsp")]))