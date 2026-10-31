(ns calva.repl.webview.code-highlight
  "Code colored the way files are, in the REPL Input and the printed output: a class for each color and font
   style, in one constructed stylesheet, since the page's Content Security Policy allows no inline styles."
  (:require
   [clojure.string :as str]))

(defn color-class
  "Returns the CSS class for the hex `color`, like `#ff7b72`, or nil for any other color."
  [color]
  (when-let [[_ hex] (re-matches #"#([0-9a-fA-F]{3,8})" (str color))]
    (str "code-color-" (str/lower-case hex))))

(def style-classes
  "The CSS class for each font style."
  {:bold "code-bold"
   :italic "code-italic"
   :underline "code-underline"
   :strikethrough "code-strikethrough"})

(def font-style-css
  "The CSS rules that give the font style classes their styles."
  [".code-bold { font-weight: bold; }"
   ".code-italic { font-style: italic; }"
   ".code-underline { text-decoration: underline; text-underline-position: under; }"
   ".code-strikethrough { text-decoration: line-through; }"
   ".code-underline.code-strikethrough { text-decoration: underline line-through; text-underline-position: under; }"])

(defn look-class
  "Returns the CSS classes for `color` and the font `styles`, like `#{:italic}`, or nil when neither has one."
  [color styles]
  (some->> (cons (color-class color) (keep style-classes (sort styles)))
           (remove nil?)
           seq
           (str/join " ")))

(defn- span
  "Returns the hiccup of the range `[from to color styles]` of `text`: a span with its classes, or the text
   when it has none."
  [text [from to color styles]]
  (let [part (subs text from to)]
    (if-let [class-name (look-class color styles)]
      [:span {:class class-name} part]
      part)))

(defn spans
  "Returns the hiccup of `text` with the `ranges`, `[from to color styles]` in order, as spans with their
   classes, and the text between them as it is."
  [text ranges]
  (let [[position parts] (reduce (fn [[position parts] [from to :as run]]
                                   [to (cond-> parts
                                         (< position from) (conj (subs text position from))
                                         :always (conj (span text run)))])
                                 [0 []]
                                 ranges)]
    (cond-> parts
      (< position (count text)) (conj (subs text position)))))

(defonce ^:private !sheet (atom nil))

(defonce ^{:private true :doc "The colors the sheet has a class for."} !sheet-colors (atom #{}))

(defn- sheet
  "Returns the stylesheet with a class for each color, created with the classes for the font styles."
  []
  (or @!sheet
      (let [new-sheet (js/CSSStyleSheet.)]
        (doseq [rule font-style-css]
          (.insertRule new-sheet rule (.. new-sheet -cssRules -length)))
        (set! (.-adoptedStyleSheets js/document) (.concat (.-adoptedStyleSheets js/document) #js [new-sheet]))
        (reset! !sheet new-sheet))))

(defn add-classes!
  "Adds a class to the stylesheet for each color of `ranges`, `[from to color ...]`, it has none for."
  [ranges]
  (let [^js the-sheet (sheet)
        new-colors (->> (map #(nth % 2) ranges)
                        (filter color-class)
                        distinct
                        (remove @!sheet-colors))]
    (doseq [color new-colors]
      (.insertRule the-sheet (str "." (color-class color) " { color: " color "; }") (.. the-sheet -cssRules -length)))
    (swap! !sheet-colors into new-colors)))

(defn- part-node
  "Returns the DOM node of a part of `spans`: a text, or a span with its class."
  [part]
  (if (string? part)
    (js/document.createTextNode part)
    (let [[_ {:keys [class]} text] part
          span (js/document.createElement "span")]
      (set! (.-className span) class)
      (set! (.-textContent span) text)
      span)))

(defn set-spans!
  "Sets the children of `element` to `text` colored with `ranges`."
  [^js element text ranges]
  (add-classes! ranges)
  (.apply (.-replaceChildren element) element (into-array (map part-node (spans text ranges)))))
