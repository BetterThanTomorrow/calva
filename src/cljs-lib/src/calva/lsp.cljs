(ns calva.lsp
  (:require ["vscode" :as vscode]
            ["vscode-languageclient" :refer [LanguageClient]]
            ["path" :as path]
            [cljs.core.async :refer [go]]
            [cljs.core.async.interop :refer-macros [<p!]]))

(def state (js/require "../state.js"))
(def config (js/require "../config.js"))
(def util (js/require "../utilities.js"))
(def definition (js/require "../providers/definition.js"))

;;;; Client middleware

(defn handle-diagnostics
  [uri diagnostics next]
  (let [repl-file-ext (.. config -default -REPL_FILE_EXT)]
    (when-not (.. uri -path (endsWith repl-file-ext))
      (next uri diagnostics))))

(defn provide-code-lenses
  [document token next]
  (if (.. state config -referencesCodeLensEnabled)
    (next document token)
    []))

(defn provide-hover
  [document position token next]
  (when-not (.. util getConnectedState)
    (next document position token)))

(defn provide-definition
  [document position token next]
  (.. (.. definition (provideClojureDefinition document position token))
      (then (fn [nrepl-definition]
              (when-not nrepl-definition
                (. js/console (log "no nrepl defintion, providing lsp definition"))
                (next document position token))))))

(defn provide-completion-item
  [document position context token next]
  (when-not (. util getConnectedState)
    (next document position context token)))

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
                         "keep-require-at-start?" true}
                        :middleware
                        {:handleDiagnostics handle-diagnostics
                         :provideCodeLenses provide-code-lenses
                         :provideHover provide-hover
                         :provideDefinition provide-definition
                         :provideCompletionItem provide-completion-item}}]
    (LanguageClient. "clojure" "Clojure Language Client"
                     (clj->js server-options)
                     (clj->js client-options))))

(defn code-lens-references-callback
  [_ line character]
  (let [line (dec line)
        character (dec character)]
    (set! (.. vscode -window -activeTextEditor -selection)
          (new (.. vscode -Selection) line character line character))
    (.. vscode -commands (executeCommand "editor.action.referenceSearch.trigger"))))

(defn register-commands 
  [^js context client]
  ;; The title of this command is dictated by clojure-lsp and is executed when the user clicks the references code lens above a symbol
  (.. context -subscriptions
      (push (.. vscode -commands
                (registerCommand "code-lens-references" code-lens-references-callback)))))


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
      (.. state -cursor (set "lspClient" client))
      (register-commands context client))))

(defn deactivate []
  (when-let [client (.. state deref (get "lspClient"))]
    (.. client stop)))

(comment
  (type (new (.. vscode -Selection) 1 2 3 4))
  (-> (next document position token)
      (. then (fn [definition]
                (. js/console (log "definition:" definition)))))
  (.. definition -provideClojureDefinition)
  (.. util getConnectedState)
  (.. state config -referencesCodeLensEnabled)
  (.. config -default -REPL_FILE_EXT)
  (js->clj (.. config -default) :keywordize-keys true)
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
