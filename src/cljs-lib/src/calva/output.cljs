(ns calva.output)

(defonce vscode (atom nil))

(defn activate-output [^js vsc]
  (reset! vscode vsc)
  (.. ^js @vscode -window (showInformationMessage "hello output world")))

(comment
  (.. @vscode -window (showInformationMessage "hello world"))
  :rcf)
