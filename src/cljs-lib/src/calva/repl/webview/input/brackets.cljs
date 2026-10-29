(ns calva.repl.webview.input.brackets
  "The REPL Input's rainbow brackets, painted by class from a stylesheet with the colors and styles
   Calva paints files with."
  (:require
   [clojure.string :as string]))

(defn- bracket-class
  [color-index]
  (str "repl-input-bracket-" color-index))

(def ^:private classes
  {:misplaced "repl-input-misplaced-bracket"
   :matched "repl-input-matched-bracket"
   :comment-form "repl-input-comment-form"
   :ignored-form "repl-input-ignored-form"
   :ignored-top-level-form "repl-input-ignored-top-level-form"})

(defn mark-ranges
  "Returns `[from to class]` for each range in `brackets`, as the extension computed them."
  [{:keys [brackets misplaced commentForms ignoredForms topLevelIgnoredForms matched]}]
  (let [classed (fn [k ranges] (for [[from to] ranges] [from to (classes k)]))]
    (filterv (fn [[from to]] (< from to))
             (concat (for [[from to color-index] brackets] [from to (bracket-class color-index)])
                     (classed :misplaced misplaced)
                     (classed :comment-form commentForms)
                     (classed :ignored-form ignoredForms)
                     (classed :ignored-top-level-form topLevelIgnoredForms)
                     (classed :matched matched)))))

(def ^:private css-properties
  "The decoration style properties CSS can paint, and their CSS names."
  {"color" "color"
   "backgroundColor" "background-color"
   "fontStyle" "font-style"
   "fontWeight" "font-weight"
   "textDecoration" "text-decoration"
   "opacity" "opacity"
   "letterSpacing" "letter-spacing"
   "cursor" "cursor"
   "border" "border"
   "borderColor" "border-color"
   "borderRadius" "border-radius"
   "borderStyle" "border-style"
   "borderWidth" "border-width"
   "outline" "outline"
   "outlineColor" "outline-color"
   "outlineStyle" "outline-style"
   "outlineWidth" "outline-width"})

(def ^:private theme-kind-selectors
  {"light" ["body.vscode-light" "body.vscode-high-contrast-light"]
   "dark" ["body.vscode-dark" "body.vscode-high-contrast:not(.vscode-high-contrast-light)"]})

(defn- css-value?
  [v]
  (or (string? v) (number? v)))

(defn- declarations
  [style]
  (string/join " " (for [[k v] style
                         :let [property (css-properties k)]
                         :when (and property (css-value? v))]
                     (str property ": " v ";"))))

(defn- rule
  [selectors style]
  (let [declarations (declarations style)]
    (when (seq declarations)
      (str (string/join ", " selectors) " { " declarations " }\n"))))

(defn- style-rules
  "The rules for `class-name` from a decoration `style`, with its `light` and `dark` parts."
  [class-name style]
  (let [selector (str "." class-name)]
    (apply str
           (rule [selector] style)
           (for [[kind prefixes] theme-kind-selectors]
             (rule (map #(str % " " selector) prefixes) (get style kind))))))

(defn- color-style
  [color]
  (if (sequential? color)
    {"light" {"color" (first color)} "dark" {"color" (second color)}}
    {"color" color}))

(defn css
  "The stylesheet that paints the classes of `mark-ranges` with `bracket-styles`."
  [{:keys [bracket-colors] :as bracket-styles}]
  (apply str
         (concat (map-indexed (fn [i color] (style-rules (bracket-class i) (color-style color)))
                              bracket-colors)
                 (for [[k class-name] classes]
                   (style-rules class-name (get bracket-styles k))))))
