(ns calva.lsp
  (:require ["vscode" :as vscode]
            ["vscode-languageclient" :refer [LanguageClient]]
            ["path" :as path]))

(defn create-client [jarPath]
  (let [server-options {:run {:command "java"
                             :args ["-jar" jarPath]}
                       :debug {:command "java"
                               :args ["-jar" jarPath]}}
        file-system-watcher (.. vscode -workspace (createFileSystemWatcher "**/.clientrc"))
        client-options {:documentSelector [{:scheme "file" :language "clojure"}]
                        :synchronize {:configurationSection "clojure-lsp"
                                      :fileEvents file-system-watcher}
                        :initializationOptions
                        {"dependency-scheme" "jar"
                         "auto-add-ns-to-new-files?" false
                         "document-formatting?" false
                         "document-range-formatting?" false
                         "keep-require-at-start?" true}}]
    (LanguageClient. "clojure" "Clojure Language Client"
                     server-options client-options)))

;; TODO: Find out what the type hint ^js does here
(defn activate [^js context]
  (let [jarPath (. path join (. context -extensionPath) "clojure-lsp.jar")]
    (js/console.log "jarPath:" jarPath)))

(comment
  (LanguageClient. "clojure" "Clojure Language Client" {} {})
  (. path join "/home/something" "clojure-lsp.jar")

  (.. vscode -workspace (createFileSystemWatcher "**/.clientrc"))

  (create-client "some-path")
  
  ;; Example interop
  (.. vscode -window (showInformationMessage "hello")))
