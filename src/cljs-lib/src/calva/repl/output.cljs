(ns calva.repl.output
  (:require ["fs" :as fs]
            [calva.state :as state]))

(defonce vscode (atom nil))

(def project-root-uri-key "connect.projectDirNew")

(defn get-first-workspace-folder-uri []
  (-> (.. ^js @vscode -workspace -workspaceFolders)
      first ;; Handle nil here?
      (.. -uri)))

(defn get-project-root-uri
  ([]
   (get-project-root-uri true))
  ([use-cache]
   (if use-cache
     (if-let [project-directory-uri (state/get-state-value project-root-uri-key)]
       project-directory-uri
       (get-first-workspace-folder-uri))
     (get-first-workspace-folder-uri))))

(defn activate [^js vsc]
  (reset! vscode vsc)
  (.. ^js @vscode -window (showInformationMessage "hello output world")))

(defn create-repl-output-file []
  (.. fs (writeFileSync
          (.. ^js @vscode -Uri (joinPath (get-project-root-uri) ".calva" "repl-output.md") -fsPath)
          "")))

(comment
  (create-repl-output-file)
  (.. fs (writeFileSync
          "/Users/brandon/development/crescent-api/.calva/output-window/repl-output.md"
          ""))
  (.. ^js @vscode -Uri (joinPath (get-project-root-uri) ".calva" "repl-output.md") -fsPath)
  "/Users/brandon/development/crescent-api/.calva/output-window/repl-output.md"
  (get-project-root-uri)

  (get-project-root-uri)
  (run!
   #(.. fs (appendFileSync
            "/Users/brandon/development/crescent-api/.calva/output-window/repl-output.md"
            "\nhello world"))
   (range 1000))
  :rcf)
