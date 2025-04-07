(ns calva.interpolate
  (:require
   [clojure.string :as string]))

(defn interpolate-variables [language-id code ^js context]
  (def language-id language-id)
  (def code code)
  (def context context)
  (let [base-interpolated
        (-> code
            (string/replace #"\$line" (str (.-currentLine context)))
            (string/replace #"\$hover-line" (str (.-hoverLine context)))
            (string/replace #"\$column" (str (.-currentColumn context)))
            (string/replace #"\$hover-column" (str (.-hoverColumn context)))
            (string/replace #"\$file-text" (second (.-currentFileText context)))
            (string/replace #"\$file" (or (some-> (.-currentFilename context)
                                                  (string/replace #"\\" "\\\\"))
                                          ""))
            (string/replace #"\$hover-file-text" (or (second (.-hoverCurrentFileText context)) ""))
            (string/replace #"\$hover-file" (or (some-> (.-hoverFilename context)
                                                       (string/replace #"\\" "\\\\"))
                                              ""))
            (string/replace #"\$ns" (.-ns context))
            (string/replace #"\$editor-ns" (.-editorNs context))
            (string/replace #"\$repl" (.-repl context))
            (string/replace #"\$selection-closing-brackets" (second (.-selectionWithBracketTrail context)))
            (string/replace #"\$selection" (.-selection context))
            (string/replace #"\$hover-text" (.-hoverText context)))]
    (if-not (= language-id "clojure")
      base-interpolated
      (-> base-interpolated
          (string/replace #"\$current-form" (second (.-currentForm context)))
          (string/replace #"\$current-pair" (second (.-currentPair context)))
          (string/replace #"\$enclosing-form" (second (.-enclosingForm context)))
          (string/replace #"\$top-level-form" (second (.-topLevelForm context)))
          (string/replace #"\$current-fn" (second (.-currentFn context)))
          (string/replace #"\$top-level-fn" (second (.-topLevelFn context)))
          (string/replace #"\$top-level-defined-symbol" (or (second (.-topLevelDefinedForm context)) ""))
          (string/replace #"\$head" (second (.-head context)))
          (string/replace #"\$tail" (second (.-tail context)))
          (string/replace #"\$hover-current-form" (or (second (.-hoverCurrentForm context)) ""))
          (string/replace #"\$hover-current-pair" (or (second (.-hoverCurrentPair context)) ""))
          (string/replace #"\$hover-enclosing-form" (or (second (.-hoverEnclosingForm context)) ""))
          (string/replace #"\$hover-top-level-form" (or (second (.-hoverTopLevelForm context)) ""))
          (string/replace #"\$hover-current-fn" (or (second (.-hoverCurrentFn context)) ""))
          (string/replace #"\$hover-top-level-fn" (or (second (.-hoverTopLevelFn context)) ""))
          (string/replace #"\$hover-top-level-defined-symbol" (or (second (.-hoverTopLevelDefinedForm context)) ""))
          (string/replace #"\$hover-head" (or (second (.-hoverHead context)) ""))
          (string/replace #"\$hover-tail" (or (second (.-hoverTail context)) ""))))))
