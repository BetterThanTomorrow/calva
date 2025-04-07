(ns calva.interpolate
  (:require
   [clojure.string :as string]))

(defn- keywordize [s]
  (-> s
      (string/replace #"^\$" "")
      keyword))

(defn- build-context-map [language-id ^js context]
  (let [safe-second (fn [x] (if (and (seq x)
                                     (second x))
                              (second x)
                              ""))
        base-map
        {:line (str (.-currentLine context))
         :hover-line (str (.-hoverLine context))
         :column (str (.-currentColumn context))
         :hover-column (str (.-hoverColumn context))
         :file-text (safe-second (.-currentFileText context))
         :file (or (some-> (.-currentFilename context)
                           (string/replace #"\\" "\\\\"))
                   "")
         :hover-file-text (or (safe-second (.-hoverCurrentFileText context)) "")
         :hover-file (or (some-> (.-hoverFilename context)
                                 (string/replace #"\\" "\\\\"))
                         "")
         :ns (str (.-ns context))
         :editor-ns (str (.-editorNs context))
         :repl (str (.-repl context))
         :selection-closing-brackets (safe-second (.-selectionWithBracketTrail context))
         :selection (str (.-selection context))
         :hover-text (str (.-hoverText context))}]
    (if (= "clojure" language-id)
      (merge base-map
             {:current-form (safe-second (.-currentForm context))
              :current-pair (safe-second (.-currentPair context))
              :enclosing-form (safe-second (.-enclosingForm context))
              :top-level-form (safe-second (.-topLevelForm context))
              :current-fn (safe-second (.-currentFn context))
              :top-level-fn (safe-second (.-topLevelFn context))
              :top-level-defined-symbol (or (safe-second (.-topLevelDefinedForm context)) "")
              :head (safe-second (.-head context))
              :tail (safe-second (.-tail context))
              :hover-current-form (or (safe-second (.-hoverCurrentForm context)) "")
              :hover-current-pair (or (safe-second (.-hoverCurrentPair context)) "")
              :hover-enclosing-form (or (safe-second (.-hoverEnclosingForm context)) "")
              :hover-top-level-form (or (safe-second (.-hoverTopLevelForm context)) "")
              :hover-current-fn (or (safe-second (.-hoverCurrentFn context)) "")
              :hover-top-level-fn (or (safe-second (.-hoverTopLevelFn context)) "")
              :hover-top-level-defined-symbol (or (safe-second (.-hoverTopLevelDefinedForm context)) "")
              :hover-head (or (safe-second (.-hoverHead context)) "")
              :hover-tail (or (safe-second (.-hoverTail context)) "")})
      base-map)))

(defn interpolate-variables [language-id code ^js context]
  (let [context-map (build-context-map language-id context)]
    (string/replace code
                    #"\$([a-zA-Z][a-zA-Z0-9-]*)"
                    (fn [[_ var-name]]
                      (context-map (keywordize var-name))))))
