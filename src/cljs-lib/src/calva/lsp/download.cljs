(ns calva.lsp.download
  (:require ["fs" :as fs]
            ["process" :as process]
            ["path" :as path]
            ["follow-redirects" :refer [https]]))

(def version-file-name "clojure-lsp-version")

(def windows-os? (= (. process -platform) "win32"))

;; TODO: Extract and write unit test? Can mock extension context.
(defn get-clojure-lsp-path [extension-path windows-os?]
  (let [file-extension (when windows-os? ".exe")]
    (. path (join extension-path
                  (str "clojure-lsp" file-extension)))))

(defn read-version-file
  [extension-path]
  (let [file-path (. path (join extension-path
                                version-file-name))]
    (.. fs (readFileSync file-path "utf8"))))

(defn configured-version-exists?
  "Check if the version configured in Calva "
  [current-version version-output])

(defn download-clojure-lsp [extension-path version]
  (js/console.log "Downloading clojure-lsp")
  (js/Promise.
   (fn [resolve reject]
     (let [current-version (read-version-file extension-path)
           url-path (str "/clojure-lsp/clojure-lsp/releases/download/"
                         version
                         "/clojure-lsp")
           clojure-lsp-path (get-clojure-lsp-path extension-path windows-os?)]
       (js/console.log "Current version of clojure-lsp is" current-version)
       (if (not= current-version version)
         (do
           (js/console.log "Downloading clojure-lsp")
           (.. https
               (get (clj->js {:hostname "github.com"
                              :path url-path})
                    (fn [^js response]
                      (let [write-stream (.. fs (createWriteStream clojure-lsp-path))]
                        (.. response
                            (pipe write-stream)
                            (on "end"
                                (fn []
                                  (.. write-stream close)
                                  (js/console.log "Clojure-lsp downloaded to" clojure-lsp-path)
                                  (resolve clojure-lsp-path)))))))))
         (js/console.log "Not downloading clojure-lsp"))
       (.. js/Promise (resolve clojure-lsp-path))))))

(comment
  (read-version-file "/home/brandon/development/calva/clojure-lsp-version")
  
  (.. (js/Promise. (fn [resolve reject]
                     (resolve "hello")))
      (then (fn [value]
              (js/console.log value)))))