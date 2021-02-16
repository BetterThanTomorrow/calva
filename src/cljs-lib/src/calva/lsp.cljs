(ns calva.lsp
  (:require ["vscode" :as vscode]
            ["vscode-languageclient" :refer [LanguageClient]]
            ["path" :as path]
            [cljs.core.async :refer [go]]
            [cljs.core.async.interop :refer-macros [<p!]]))

(def state (js/require "../state.js"))

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
                     (clj->js server-options)
                     (clj->js client-options))))

;; TODO: Find out what the type hint ^js does here
(defn activate [^js context]
  (let [jar-path (. path join (. context -extensionPath) "clojure-lsp.jar")
        client (create-client jar-path)]
    (. client start)
    (.. vscode -window
        (setStatusBarMessage
         "$(sync~spin) Initializing Clojure language features via clojure-lsp"
         (. client onReady)))
    (go
      (<p! (. client onReady))
      (.. state -cursor (set "lspClient" client)))))

(defn deactivate []
  (when-let [client (.. state deref (get "lspClient"))]
    (.. client stop)))

(comment
  (js->clj (.. state (config)))

  (.. state deref (get "lspClient"))
  (.. state -cursor (set "lspClient" "hello"))

  (.. vscode -window (setStatusBarMessage "$(sync~spin) Initializing Clojure language features via clojure-lsp"))

  (LanguageClient. "clojure" "Clojure Language Client" {} {})
  (. path join "/home/something" "clojure-lsp.jar")

  (.. vscode -workspace (createFileSystemWatcher "**/.clientrc"))

  (js/console.log (create-client "some-path"))

  (js/console.log (clj->js {:run {:command "java"
                                  :args ["-jar" "jarPath"]}
                            :debug {:command "java"
                                    :args ["-jar" "jarPath"]}}))


  (. state config)
  ;; Example interop
  (.. vscode -window (showInformationMessage "hello")))
