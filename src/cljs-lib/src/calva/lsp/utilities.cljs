(ns calva.lsp.utilities
  (:require ["path" :as path]
            ["fs" :as fs]))

(def version-file-name "clojure-lsp-version")

(defn get-version-file-path
  [extension-path]
  (. path (join extension-path version-file-name)))

(defn get-clojure-lsp-path [extension-path windows-os?]
  (let [file-extension (when windows-os? ".exe")]
    (. path (join extension-path
                  (str "clojure-lsp" file-extension)))))

(defn read-version-file
  [extension-path]
  (let [file-path (get-version-file-path extension-path)]
    (try
      (.. fs (readFileSync file-path "utf8"))
      (catch js/Error e
        (js/console.log "Could not read clojure-lsp version file." (. e -message))
        ""))))