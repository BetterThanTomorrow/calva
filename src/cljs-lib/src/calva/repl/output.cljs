(ns calva.repl.output
  (:require ["fs" :as fs]))

(defonce vscode (atom nil))

(defn activate [^js vsc]
  (reset! vscode vsc)
  (.. ^js @vscode -window (showInformationMessage "hello output world")))

(defn create-repl-output-file [])

(comment
  (run!
   #(.. fs (appendFileSync
            "/Users/brandon/development/crescent-api/.calva/output-window/repl-output.md"
            "\nhello world"))
   (range 1000))
  :rcf)
