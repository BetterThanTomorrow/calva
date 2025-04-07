(ns calva.interpolate
  (:require
   [clojure.string :as string]))

(defn- keywordize [s]
  (-> s
      (string/replace #"^\$" "")
      keyword))

(defn- extract-context [language-id ^js context]
  (let [safe-second (fn [x] (if (and (seq x)
                                     (second x))
                              (second x)
                              ""))
        base-map
        {:line (.-currentLine context)
         :hover-line (.-hoverLine context)
         :column (.-currentColumn context)
         :hover-column (.-hoverColumn context)
         :file-text (safe-second (.-currentFileText context))
         :file (or (some-> (.-currentFilename context)
                           (string/replace #"\\" "\\\\"))
                   "")
         :hover-file-text (or (safe-second (.-hoverCurrentFileText context)) "")
         :hover-file (or (some-> (.-hoverFilename context)
                                 (string/replace #"\\" "\\\\"))
                         "")
         :ns (.-ns context)
         :editor-ns (.-editorNs context)
         :repl (.-repl context)
         :selection-closing-brackets (safe-second (.-selectionWithBracketTrail context))
         :selection (.-selection context)
         :hover-text (.-hoverText context)}]
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

(defn- unescape [s]
  (string/replace s #"\\(.)" "$1"))

(defn interpolate-variables [language-id code ^js js-context]
  (let [context (extract-context language-id js-context)]
    (-> code
        (string/replace
         #"\$([a-zA-Z][a-zA-Z0-9-]*)"
         (fn [[_ var-name]]
           (str (get context (keywordize var-name) ""))))
        (string/replace
         #"\$\{((?:\\.|[^{}])*)\}"
         (fn [[_ content]]
           (let [parts (string/split content #"(?<!\\)\|")
                 var-name (first parts)
                 modifiers (rest parts)
                 initial-value (if (re-find #"^[a-zA-Z][a-zA-Z0-9-]*$" var-name)
                                 (get context (keywordize var-name) "")
                                 var-name)]
             (loop [remaining-mods modifiers
                    current-value initial-value]
               (if (empty? remaining-mods)
                 current-value
                 (let [modifier (first remaining-mods)
                       args-needed (case modifier
                                     ("replace" "replace-first") 2
                                     0)
                       args (take args-needed (rest remaining-mods))
                       next-modifiers (drop (inc args-needed) remaining-mods)]
                   (recur next-modifiers
                          (case modifier
                            "pr-str" (pr-str current-value)
                            "replace" (if (= 2 (count args))
                                        (string/replace current-value
                                                        (re-pattern (first args))
                                                        (unescape (second args)))
                                        current-value)
                            "replace-first" (if (= 2 (count args))
                                              (string/replace-first current-value
                                                                    (re-pattern (first args))
                                                                    (unescape (second args)))
                                              current-value)
                            current-value)))))))))))
