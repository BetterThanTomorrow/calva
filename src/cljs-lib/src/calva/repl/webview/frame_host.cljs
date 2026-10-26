(ns calva.repl.webview.frame-host
  "Opens the source of a stacktrace frame that was clicked in an Output view."
  (:require
   [calva.util :as util]))

(defn- editor-column
  "Returns the column of a visible text editor, so the file opens beside the Output view."
  [^js vscode]
  (or (some-> ^js (first (.. vscode -window -visibleTextEditors)) .-viewColumn)
      (.. vscode -ViewColumn -One)))

(defn open-frame!
  "Opens `file-url`, a `file:` or `jar:file:` URL, at the 1-based `line`."
  [file-url line]
  (when-let [^js vscode @util/vscode]
    (let [position (new (.-Position vscode) (max 0 (dec line)) 0)]
      (-> (.. vscode -window (showTextDocument (.. vscode -Uri (parse file-url))
                                               #js {:selection (new (.-Range vscode) position position)
                                                    :viewColumn (editor-column vscode)}))
          (.catch #(util/log-to-console :error "Cannot open the stacktrace frame" file-url (.-message %)))))))
