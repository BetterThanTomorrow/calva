(ns calva.repl.input.brackets
  "Which brackets close themselves in the REPL Input, and how its brackets are painted, under the settings
   that decide it in Clojure files.")

(def close-settings
  "Read for Clojure, since they can be set per language."
  ["editor.autoClosingBrackets" "editor.autoClosingQuotes"])

(def highlight-settings
  ["calva.highlight.enableBracketColors"
   "calva.highlight.bracketColors"
   "calva.highlight.cycleBracketColors"
   "calva.highlight.misplacedBracketStyle"
   "calva.highlight.matchedBracketStyle"
   "calva.highlight.commentFormStyle"
   "calva.highlight.ignoredFormStyle"
   "calva.highlight.ignoredTopLevelFormStyle"])

(defn close-brackets
  [settings]
  (cond-> []
    (not= "never" (get settings "editor.autoClosingBrackets")) (into ["(" "[" "{"])
    (not= "never" (get settings "editor.autoClosingQuotes")) (conj "\"")))

(defn- highlight-setting
  [settings k]
  (get settings (str "calva.highlight." k)))

(defn rainbow-options
  "The options for Calva's rainbow bracket function."
  [settings]
  {:colorCount (max 1 (count (highlight-setting settings "bracketColors")))
   :cycleBracketColors (boolean (highlight-setting settings "cycleBracketColors"))})

(def ^:private default-styles
  {:misplaced {"light" {"color" "#fff" "backgroundColor" "#c33"}
               "dark" {"color" "#ccc" "backgroundColor" "#933"}}
   :matched {"light" {"backgroundColor" "#d0d0d0"}
             "dark" {"backgroundColor" "#444"}}
   :comment-form {"fontStyle" "italic"}
   :ignored-form {"textDecoration" "none; opacity: 0.5"}})

(defn bracket-styles
  "The bracket colors and the decoration styles of the brackets and forms, falling back on the styles
   Calva paints files with."
  [settings]
  (let [style (fn [k default] (or (highlight-setting settings k) default))
        ignored-form (style "ignoredFormStyle" (:ignored-form default-styles))]
    {:bracket-colors (if (highlight-setting settings "enableBracketColors")
                       (vec (highlight-setting settings "bracketColors"))
                       [])
     :misplaced (style "misplacedBracketStyle" (:misplaced default-styles))
     :matched (style "matchedBracketStyle" (:matched default-styles))
     :comment-form (style "commentFormStyle" (:comment-form default-styles))
     :ignored-form ignored-form
     :ignored-top-level-form (style "ignoredTopLevelFormStyle" ignored-form)}))

(defn editor-settings
  "What the REPL Input's editor takes from the settings."
  [settings]
  {:close-brackets (close-brackets settings)
   :bracket-styles (bracket-styles settings)})
