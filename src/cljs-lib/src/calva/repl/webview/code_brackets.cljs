(ns calva.repl.webview.code-brackets
  "Calva's rainbow brackets and the forms it marks, in the REPL Input and the printed code, painted by class
   from a stylesheet with the colors and styles Calva paints files with."
  (:require
   [garden.core :as garden]))

(defn- bracket-class
  [color-index]
  (str "code-bracket-" color-index))

(def ^:private classes
  {:misplaced "code-misplaced-bracket"
   :matched "code-matched-bracket"
   :comment-form "code-comment-form"
   :ignored-form "code-ignored-form"
   :ignored-top-level-form "code-ignored-top-level-form"})

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
  (into {} (for [[k v] style
                 :let [property (css-properties k)]
                 :when (and property (css-value? v))]
             [(keyword property) v])))

(defn- style-rules
  "The rules for `class-name` from a decoration `style`, with its `light` and `dark` parts, on spans, so they
   win over the token colors' classes as Calva's decorations do in files."
  [class-name style]
  (let [selector (str "span." class-name)]
    (for [[selectors style] (cons [[selector] style]
                                  (for [[kind prefixes] theme-kind-selectors]
                                    [(map #(str % " " selector) prefixes) (get style kind)]))
          :let [declarations (declarations style)]
          :when (seq declarations)]
      (conj (vec selectors) declarations))))

(defn- color-style
  [color]
  (if (sequential? color)
    {"light" {"color" (first color)} "dark" {"color" (second color)}}
    {"color" color}))

(defn rules
  "Returns the Garden rules that paint the classes of `mark-ranges` with `bracket-styles`."
  [{:keys [bracket-colors] :as bracket-styles}]
  (vec (concat (apply concat (map-indexed (fn [i color] (style-rules (bracket-class i) (color-style color)))
                                          bracket-colors))
               (mapcat (fn [[k class-name]] (style-rules class-name (get bracket-styles k)))
                       classes))))

(defn css
  "The stylesheet that paints the classes of `mark-ranges` with `bracket-styles`."
  [bracket-styles]
  (garden/css (rules bracket-styles)))

(defonce ^:private !sheet (atom nil))

(defn set-css!
  "Sets the page's bracket stylesheet to `css`."
  [css]
  (let [^js sheet (or @!sheet
                      (let [sheet (js/CSSStyleSheet.)]
                        (set! (.-adoptedStyleSheets js/document) (.concat (.-adoptedStyleSheets js/document) #js [sheet]))
                        (reset! !sheet sheet)))]
    (.replaceSync sheet css)))
