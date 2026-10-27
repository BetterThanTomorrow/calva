(ns calva.repl.webview.frame-host
  "Opens the source of a stacktrace frame that was clicked in an Output view."
  (:require
   [calva.util :as util]))

(defonce ^:private !java-source-url-fn (atom nil))

(defn ^:export set-java-source-lookup!
  "Registers how the host finds the source of a Java class's member: a function of session key,
   class name and member that returns a promise of a file URL, or of nil."
  [f]
  (reset! !java-source-url-fn f))

(defn- editor-column
  "Returns the column of the first visible text editor, or the first column when there is none."
  [^js vscode]
  (or (some-> ^js (first (.. vscode -window -visibleTextEditors)) .-viewColumn)
      (.. vscode -ViewColumn -One)))

(defn open-frame!
  "Opens `file-url`, a `file:` or `jar:file:` URL, at the 1-based `line` and `column`."
  [file-url line column]
  (when-let [^js vscode @util/vscode]
    (let [position (new (.-Position vscode) (max 0 (dec line)) (max 0 (dec (or column 1))))]
      (-> (.. vscode -window (showTextDocument (.. vscode -Uri (parse file-url))
                                               #js {:selection (new (.-Range vscode) position position)
                                                    :viewColumn (editor-column vscode)}))
          (.catch #(util/log-to-console :error "Cannot open the stacktrace frame" file-url (.-message %)))))))

(defn open-java-frame!
  "Opens the source of `class-name` at `line`, or says that no source was found."
  [session-key class-name member line]
  (when-let [lookup @!java-source-url-fn]
    (-> (lookup session-key class-name member)
        (.then (fn [file-url]
                 (if file-url
                   (open-frame! file-url line 1)
                   (.. ^js @util/vscode -window (showInformationMessage (str "No source found for " class-name))))))
        (.catch #(util/log-to-console :error "Cannot look up the source of" class-name (.-message %))))))
