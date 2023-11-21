(ns calva.repl.markdown-output
  (:require ["fs" :as fs]
            [calva.util :as util]
            [cljs.pprint :as pprint]))

(defn get-repl-output-file-uri []
  (.. ^js @util/vscode
      -Uri
      (joinPath (util/get-project-root-uri) ".calva" "output-window" "repl-output.md")))

(defn get-repl-output-file-fs-path []
  (.. (get-repl-output-file-uri) -fsPath))

;; This would be called when a repl is connected, or sooner
(defn create-repl-output-file []
  (.. fs (writeFileSync (get-repl-output-file-fs-path) "")))

(defn write-to-repl-output-file [text]
  (.. fs (appendFileSync (get-repl-output-file-fs-path) text)))

(defn clear-repl-output-file []
  (.. fs (writeFileSync (get-repl-output-file-fs-path) "")))

(defn show-repl-output-file-preview-to-side []
  (.. ^js @util/vscode
      -commands
      (executeCommand "markdown.showPreviewToSide" (get-repl-output-file-uri))))

(defn print-clojure-code-block [code]
  (write-to-repl-output-file (str "```clojure\n" code "\n```\n")))

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
