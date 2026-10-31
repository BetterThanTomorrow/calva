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

(defn- edges
  "Returns where the `ranges` and the `marks` of `text` start and end, in order, with its start and end."
  [text ranges marks]
  (vec (into (sorted-set 0 (count text)) (mapcat (fn [[from to]] [from to])) (concat ranges marks))))

(defn- range-index
  "Returns the index in `ranges` of the first range that ends after `position`, from the index `i` on."
  [ranges i position]
  (if (and (< i (count ranges)) (<= (second (nth ranges i)) position))
    (recur ranges (inc i) position)
    i))

(defn- active-marks
  "Returns `[i active]`: the index in `marks`, sorted by start, of the first mark that starts after `position`,
   from the index `i` on, and the marks over `position`, from those `active` before it and the ones it passes."
  [marks i active position]
  (loop [i i
         active (filterv #(> (second %) position) active)]
    (if (and (< i (count marks)) (<= (first (nth marks i)) position))
      (recur (inc i) (conj active (nth marks i)))
      [i active])))

(defn- range-class
  "Returns the classes of the range of `ranges` at the index `i`, when it covers `position`."
  [ranges i position]
  (when-let [[from _ color styles] (get ranges i)]
    (when (<= from position)
      (look-class color styles))))

(defn segments
  "Returns `[from to classes]` for each part of `text` between the edges of its `ranges`, `[from to color
   styles]` in order, and its `marks`, `[from to class]`: the classes of the range and of the marks over it."
  [text ranges marks]
  (let [edges (edges text ranges marks)
        ranges (vec ranges)
        marks (vec (sort-by first marks))]
    (loop [i 0
           range-i 0
           mark-i 0
           active []
           parts (transient [])]
      (if (>= (inc i) (count edges))
        (persistent! parts)
        (let [from (nth edges i)
              range-i (range-index ranges range-i from)
              [mark-i active] (active-marks marks mark-i active from)
              classes (remove nil? (cons (range-class ranges range-i from) (map #(nth % 2) active)))]
          (recur (inc i) range-i mark-i active (conj! parts [from (nth edges (inc i)) classes])))))))

(defn spans
  "Returns the hiccup of `text` with its `ranges`, `[from to color styles]` in order, and its `marks`,
   `[from to class]`, as spans with their classes, and the text with no class as it is."
  ([text ranges]
   (spans text ranges []))
  ([text ranges marks]
   (for [[from to classes] (segments text ranges marks)
         :let [part (subs text from to)]]
     (if (seq classes)
       [:span {:class (str/join " " classes)} part]
       part))))

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
  "Sets the children of `element` to `text` colored with `ranges` and marked with `marks`."
  ([^js element text ranges]
   (set-spans! element text ranges []))
  ([^js element text ranges marks]
   (add-classes! ranges)
   (.apply (.-replaceChildren element) element (into-array (map part-node (spans text ranges marks))))))
