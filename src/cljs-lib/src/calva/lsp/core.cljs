(ns calva.lsp.core
  (:require ["vscode" :as vscode]
            ["vscode-languageclient" :refer [LanguageClient Position]]
            ["child_process" :refer [exec execSync]]
            ["fs" :as fs]
            [cljs.core.async :refer [go]]
            [cljs.core.async.interop :refer-macros [<p!]]
            [clojure.string :as str]
            [calva.state :as state]
            [calva.lsp.download :refer [download-clojure-lsp]]
            [calva.utilities :as util]
            [calva.lsp.utilities :as lsp.util]))

(def config (js/require "../config.js"))
(def util (js/require "../utilities.js"))
(def definition (js/require "../providers/definition.js"))

(def client-key "lspClient")

;;;; Client middleware

(defn handle-diagnostics
  [uri diagnostics next]
  (let [repl-file-ext (.. config -REPL_FILE_EXT)]
    (when-not (.. uri -path (endsWith repl-file-ext))
      (next uri diagnostics))))

(defn provide-code-lenses
  [document token next]
  (if (.. config getConfig -referencesCodeLensEnabled)
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

;; TODO: Switch bash to sh?
(defn create-client [clojure-lsp-path]
  (let [server-options {:run {:command "bash"
                              :args ["-c" clojure-lsp-path]}
                        :debug {:command "bash"
                                :args ["-c" clojure-lsp-path]}}
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

(defn create-prompt-for-input-fn
  [placeholder]
  (fn []
    (.. vscode -window
        (showInputBox
         (clj->js {:value ""
                   :placeHolder placeholder
                   :validateInput (fn [input]
                                    (when (empty? (str/trim input))
                                      "Empty input"))})))))

(def lsp-commands
  #{{:name "clean-ns"}
    {:name "add-missing-libspec"}
    {:name "cycle-privacy"}
    {:name "expand-let"}
    {:name "thread-first"}
    {:name "thread-first-all"}
    {:name "thread-last"}
    {:name "thread-last-all"}
    {:name "inline-symbol"}
    {:name "unwind-all"}
    {:name "unwind-thread"}
    {:name "introduce-let"
     :extra-param-fn (create-prompt-for-input-fn "Bind to")}
    {:name "move-to-let"
     :extra-param-fn (create-prompt-for-input-fn "Bind to")}
    {:name "extract-function"
     :extra-param-fn (create-prompt-for-input-fn "Function name")}
    {:name "server-info"
     :category "calva.diagnostics"}})

(defn register-lsp-command
  [^js client {:keys [name extra-param-fn category]}]
  (let [category (or category "calva.refactor")
        calva-command-name (str category "."
                                (str/replace name #"-[a-z]"
                                             (fn [m]
                                               (. (nth m 1) toUpperCase))))
        command-callback
        (fn []
          (let [editor (.. vscode -window -activeTextEditor)
                document (. util (getDocument (. editor -document)))]
            (when (and document (= (. document -languageId) "clojure"))
              (go
                (let [line (.. editor -selection -start -line)
                      column (.. editor -selection -start -character)
                      doc-uri (str
                               (.. document -uri -scheme)
                               "://"
                               (.. document -uri -path))
                      params [doc-uri, line, column]
                      extra-param (when extra-param-fn
                                    (<p! (extra-param-fn)))]
                  (when (or (not extra-param-fn) extra-param)
                    (.. (.. client (sendRequest
                                    "workspace/executeCommand"
                                    (clj->js {:command name
                                              :arguments (if extra-param
                                                           (conj params extra-param)
                                                           params)})))
                        (catch js/console.error))))))))]
    (.. vscode -commands (registerCommand calva-command-name command-callback))))

(defn register-commands
  [^js context client]
  ;; The title of this command is dictated by clojure-lsp and is executed when the user clicks the references code lens above a symbol
  (.. context -subscriptions
      (push (.. vscode -commands
                (registerCommand "code-lens-references" code-lens-references-callback))))
  (run! (fn [command]
          (register-lsp-command client command))
        lsp-commands))

(defn handle-toggle-references-code-lens
  [^js event]
  (when (.. event (affectsConfiguration "calva.referencesCodeLens.enabled"))
    (let [visible-editors (filter
                           (fn [editor]
                             (= (.. editor -document -uri -scheme) "file"))
                           (.. vscode -window -visibleTextEditors))]
      ;; Hacky solution for triggering codeLens refresh
      ;; Could not find a better way, aside from possibly changes to clojure-lsp
      ;; https://github.com/microsoft/vscode-languageserver-node/issues/705
      (run! (fn [editor]
              (js/console.log "adding edits for:" (.. editor -document -uri toString))
              (let [edit1 ^js (new (.. vscode -WorkspaceEdit))
                    _ (.. edit1 (insert (.. editor -document -uri)
                                        (new (.. vscode -Position) 0 0)
                                        "\n"))
                    edit2 ^js (new (.. vscode -WorkspaceEdit))
                    _ (.. edit2 (delete (.. editor -document -uri)
                                        (new (.. vscode -Range) 0 0 1 0)))]
                (go
                  (<p! (.. vscode -workspace (applyEdit edit1)))
                  (<p! (.. vscode -workspace (applyEdit edit2))))))
            visible-editors))))

(defn register-event-handlers
  [^js context]
  (.. context -subscriptions
      (push (.. vscode -workspace
                (onDidChangeConfiguration handle-toggle-references-code-lens)))))

(defn show-initializing-status!
  [hide-when-done]
  (.. vscode -window
      (setStatusBarMessage
       "$(sync~spin) Initializing Clojure language features via clojure-lsp"
       hide-when-done)))

(defn start-client!
  "Returns a promise that resolves once the client has been started and post-start operations are completed."
  [clojure-lsp-path ^js context]
  (let [client (create-client clojure-lsp-path)]
    (js/console.log "Starting clojure-lsp at" clojure-lsp-path)
    (. client start)
    (let [on-ready-promise (. client onReady)]
      (show-initializing-status! on-ready-promise)
      (.. on-ready-promise
          (then #(do
                   (state/set-state-value! client-key client)
                   (register-commands context client)
                   (register-event-handlers context)
                   (js/Promise.resolve)))))))

(defn show-downloading-status!
  [hide-when-done]
  (.. vscode -window
      (setStatusBarMessage
       "$(sync~spin) Downloading clojure-lsp"
       hide-when-done)))

(defn activate [^js context]
  (let [extension-path (. context -extensionPath)
        configured-version (.. config -CLOJURE_LSP_VERSION)
        current-version (lsp.util/read-version-file extension-path)
        clojure-lsp-path (lsp.util/get-clojure-lsp-path extension-path util/windows-os?)]
    (js/console.log "current-version = configured-version:" (= current-version configured-version))
    (if (not= configured-version current-version)
      (let [download-promise (download-clojure-lsp extension-path configured-version)]
        (js/console.log "Download-promise:" download-promise)
        (show-downloading-status! download-promise)
        (.. download-promise
            (then (fn [clojure-lsp-path]
                    (start-client! clojure-lsp-path context)))))
      (do
        (js/console.log "Versions are equal. Starting client.")
        (start-client! clojure-lsp-path context)))))

(defn deactivate []
  (when-let [client (state/get-state-value client-key)]
    (.. client stop)))

(defn get-references
  ([^LanguageClient client uri ^Position position]
   (get-references client uri position true))
  ([^LanguageClient client uri ^Position position include-declaration]
   (.. client
       (sendRequest "textDocument/references"
                    (clj->js {:textDocument {:uri uri}
                              :position position
                              :context {:includeDeclaration include-declaration}})))))

(defn get-document-symbols
  [^LanguageClient client uri]
  (.. client
      (sendRequest "textDocument/documentSymbol"
                   (clj->js {:textDocument {:uri uri}}))))

(comment
  (.. config getConfig -clojureLspPath)
  (time (.. fs (writeFileSync "/home/brandon/development/calva/clojure-lsp-version"
                              "hello world")))
  (time (.. fs (readFileSync "/home/brandon/development/calva/clojure-lsp-version" "utf8")))
  (.. config getConfig -referencesCodeLensEnabled)
  (cljs.pprint/pprint @state/state)
  (exec "ls", (fn [error stdout stderr]
                (println stdout)))

  (try
    (time (.. (execSync "sh -c \"/home/brandon/development/calva/clojure-lsp --version\"") toString))
    (catch js/Error e
      (js/console.error e)))
  (str "hello" nil)
  (js/console.error "Hello test"))
