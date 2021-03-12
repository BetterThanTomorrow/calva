(ns calva.lsp.download
  (:require ["fs" :as fs]
            ["process" :as process]
            ["path" :as path]
            ["follow-redirects" :refer [https]]
            ["extract-zip" :as extract-zip]
            ["vscode" :as vscode]
            [calva.lsp.utilities :as lsp.util]
            [calva.utilities :as util]))

(def zip-file-name
  (condp = (.. process -platform)
    "darwin" "clojure-lsp-native-macos-amd64.zip"
    "linux" "clojure-lsp-native-linux-amd64.zip"
    "win32" "clojure-lsp-native-windows-amd64.zip"))

(defn get-zip-file-path [extension-path]
  (. path (join extension-path zip-file-name)))

(defn write-version-file
  [extension-path version]
  (js/console.log "Writing version file")
  (let [file-path (lsp.util/get-version-file-path extension-path)]
    (try
      (.. fs (writeFileSync file-path version))
      (catch js/Error e
        (js/console.log "Could not write clojure-lsp version file." (. e -message))))))

(defn unzip-file [zip-file-path extension-path]
  (js/console.log "Unzipping file")
  (extract-zip zip-file-path
               (clj->js {:dir extension-path})))

(defn download-zip-file [url-path file-path]
  (js/console.log "Downloading clojure-lsp from" url-path)
  (js/Promise.
   (fn [resolve reject]
     (.. https
         (get (clj->js {:hostname "github.com"
                        :path url-path})
              (fn [^js response]
                (if (= (. response -statusCode) 200)
                  (let [write-stream (.. fs (createWriteStream file-path))]
                    (.. response
                        (on "end"
                            (fn []
                              (.. write-stream close)
                              (js/console.log "Clojure-lsp zip file downloaded to" file-path)
                              (resolve)))
                        (pipe write-stream)))
                  (let [error (js/Error. (. response -statusMessage))]
                    (. response resume) ;; Consume response to free up memory
                    (reject error)))))
         (on "error" reject)))))

(defn get-backup-path
  [clojure-lsp-path]
  (str clojure-lsp-path "_backup"))

(defn backup-existing-file
  [clojure-lsp-path]
  (js/console.log "Backing up existing clojure-lsp file")
  (try
    (.. fs (renameSync clojure-lsp-path (get-backup-path clojure-lsp-path)))
    (catch js/Error e
      (js/console.log "Error while backing up existing clojure-lsp file."
                      (. e -message)))))

(defn show-downloading-status! [download-promise]
  (.. vscode -window
      (setStatusBarMessage "$(sync~spin) Downloading clojure-lsp"
                           download-promise)))

(defn download-clojure-lsp 
  "Downloads clojure-lsp and returns a promise that resolves to the path of the file to run. If the download fails, the path to the backup file will be returned."
  [extension-path version]
  (js/console.log "Downloading clojure-lsp version")
  (let [url-path (str "/clojure-lsp/clojure-lsp/releases/download/"
                      version
                      "/" zip-file-name)
        zip-file-path (get-zip-file-path extension-path)
        clojure-lsp-path (lsp.util/get-clojure-lsp-path extension-path util/windows-os?)]
    (backup-existing-file clojure-lsp-path)
    (.. (download-zip-file url-path zip-file-path)
        (then (fn []
                (unzip-file zip-file-path extension-path)))
        (then (fn []
                (write-version-file extension-path version)
                (js/Promise.resolve clojure-lsp-path)))
        (catch (fn [error]
                 (js/console.log "Error downloading clojure-lsp." error)
                 (js/Promise.resolve (get-backup-path clojure-lsp-path)))))))

(comment
  (backup-existing-file "/home/brandon/development/calva/clojure-lsp")
  (extract-zip "/home/brandon/development/calva/clojure-lsp-native-linux-amd64.zip"
               (clj->js {:dir "/home/brandon/development/calva"}))
  
  (lsp.util/read-version-file "/home/brandon/development/calva/clojure-lsp-version")

  (.. (js/Promise. (fn [resolve reject]
                     (resolve "hello")))
      (then (fn [value]
              (js/console.log value)))))