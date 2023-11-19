(ns calva.repl.output
  (:require ["fs" :as fs]
            [calva.state :as state]
            [cljs.pprint :as pprint]))

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

(def repl-output-file-uri (.. ^js @vscode
                              -Uri
                              (joinPath (get-project-root-uri) ".calva" "output-window" "repl-output.md")))

(def repl-output-file-fs-path (.. repl-output-file-uri -fsPath))

;; This would be called when a repl is connected, or sooner
(defn create-repl-output-file []
  (.. fs (writeFileSync repl-output-file-fs-path "")))

(defn write-to-repl-output-file [text]
  (.. fs (appendFileSync repl-output-file-fs-path text)))

(defn clear-repl-output-file []
  (.. fs (writeFileSync repl-output-file-fs-path "")))

(defn show-repl-output-file-preview-to-side []
  (.. ^js @vscode
      -commands
      (executeCommand "markdown.showPreviewToSide" repl-output-file-uri)))

(defn print-clojure-code-block [code]
  (write-to-repl-output-file (str "```clojure\n" code "\n```\n")))

(defn activate [^js vsc]
  (reset! vscode vsc)
  (.. ^js @vscode -window (showInformationMessage "hello output world")))

(comment
  (create-repl-output-file)

  (show-repl-output-file-preview-to-side)

  (print-clojure-code-block "(+ 1 2)")

  (run!
   #(print-clojure-code-block "(+ 1 2)")
   (range 1000))

  (print-clojure-code-block (with-out-str (pprint/pprint (zipmap
                                                          [:a :b :c :d :e]
                                                          (repeat
                                                           (zipmap [:a :b :c :d :e]
                                                                   (take 5 (range))))))))

  (clear-repl-output-file)
  :rcf)
