(ns calva.output)

(defonce ^js vscode (atom nil))

(defn activate-output [^js vsc]
  (reset! vscode vsc)
  (.. @vscode -window (showInformationMessage "hello output world")))

(comment
  (.. @vscode -window (showInformationMessage "hello world"))
  :rcf)
