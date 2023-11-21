(ns calva.repl.webview-output
  (:require [calva.util :as util]))

(defn create-repl-output-webview-panel []
  (.. @util/vscode -window (createWebviewPanel "calva:repl-output"
                                               "REPL Output"
                                               2
                                               (clj->js {#_#_:enableScripts true}))))

(defn get-webview-content []
  "<!DOCTYPE html>
<html lang=\"en\">
<head>
    <meta charset=\"UTF-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <title>Cat Coding</title>
</head>
<body>
    <img src=\"https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif\" width=\"300\" />
</body>
</html>")

(comment
  (def repl-output-panel (create-repl-output-webview-panel))

  (set! (.. repl-output-panel -webview -html) (get-webview-content))

  (get-webview-content)
  :rcf)
