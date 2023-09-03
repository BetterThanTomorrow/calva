(ns calva.repl.output
  (:require ["fs" :as fs]
            [calva.state :as state]))

(defonce vscode (atom nil))

(def project-root-uri-key "connect.projectDirNew")

(defn get-first-workspace-folder-uri []
  (-> (.. @vscode -workspace -workspaceFolders)
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

(defn create-repl-output-file [])

(comment
  (get-project-root-uri)
  @state/state
  (or true false false)
  (run!
   #(.. fs (appendFileSync
            "/Users/brandon/development/crescent-api/.calva/output-window/repl-output.md"
            "\nhello world"))
   (range 1000))
  :rcf)
