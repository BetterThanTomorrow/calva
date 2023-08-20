(ns calva.repl.output)

(defonce vscode (atom nil))

(defn activate [^js vsc]
  (reset! vscode vsc)
  (.. ^js @vscode -window (showInformationMessage "hello output world")))
