(ns calva.repl.webview.input.highlight
  "Highlighting for the REPL Input: the extension's colors from Calva's grammar and clojure-lsp's semantic
   tokens, and the highlighter the Output views use until those arrive."
  (:require
   [clojure.string :as str]
   ["highlight.js/lib/core" :as hljs]))

(defn scope-class
  "Returns the CSS classes highlight.js gives `scope`, e.g. `title.function` → `hljs-title function_`."
  [scope]
  (let [[head & more] (str/split scope #"\.")]
    (str/join " " (cons (str "hljs-" head)
                        (map-indexed (fn [i piece] (str piece (apply str (repeat (inc i) "_"))))
                                     more)))))

(defn highlight-ranges
  "Returns `[from to class]` for each scoped node highlight.js finds when it reads `text` as Clojure."
  [text]
  (let [^js result (.highlight hljs text #js {:language "clojure" :ignoreIllegals true})
        root (.. result -_emitter -rootNode)
        walk (fn walk [ranges ^js node offset]
               (if (string? node)
                 [ranges (+ offset (count node))]
                 (let [[ranges end] (reduce (fn [[ranges o] child] (walk ranges child o))
                                            [ranges offset]
                                            (.-children node))
                       scope (.-scope node)]
                   [(cond-> ranges
                      (and scope (< offset end)) (conj [offset end (scope-class scope)]))
                    end])))]
    (first (walk [] root 0))))

(defn- restyled
  "Returns the font styles `styles`, like `#{:italic}`, with the ones `font-styles`, like `{:bold true}`, sets
   added and the ones it unsets removed."
  [styles font-styles]
  (reduce-kv (fn [styles style set?]
               ((if set? conj disj) styles style))
             (set styles)
             font-styles))

(defn layered
  "Returns `[from to color styles]` for each run of one color and font styles, from the `grammar` ranges,
   `[from to color styles]`, with the `semantic` ranges, `[from to color font-styles]`, over them. A semantic
   range's color replaces the grammar's, and its font styles set or unset the grammar's."
  [grammar semantic]
  (let [ranges (concat grammar semantic)
        looks (as-> (transient (vec (repeat (reduce max 0 (map second ranges)) [nil nil]))) looks
                (reduce (fn [looks [from to color styles]]
                          (reduce #(assoc! %1 %2 [color styles]) looks (range from to)))
                        looks
                        grammar)
                (reduce (fn [looks [from to color font-styles]]
                          (reduce (fn [looks i]
                                    (let [[grammar-color styles] (nth looks i)]
                                      (assoc! looks i [(or color grammar-color) (not-empty (restyled styles font-styles))])))
                                  looks
                                  (range from to)))
                        looks
                        semantic))]
    (->> (persistent! looks)
         (map-indexed vector)
         (partition-by second)
         (keep (fn [run]
                 (let [[from [color styles]] (first run)]
                   (when (or color (seq styles))
                     [from (inc (first (last run))) color styles]))))
         vec)))

(defn mapped
  "Returns `ranges` with their ends moved by `map-pos`, as CodeMirror's `mapPos`, without the ranges that
   end up empty."
  [ranges map-pos]
  (vec (keep (fn [[from to & more]]
               (let [from (map-pos from 1)
                     to (map-pos to -1)]
                 (when (< from to)
                   (into [from to] more))))
             ranges)))

(defn color-class
  "Returns the CSS class for the hex `color`, like `#ff7b72`, or nil for any other color."
  [color]
  (when-let [[_ hex] (re-matches #"#([0-9a-fA-F]{3,8})" (str color))]
    (str "repl-input-color-" (str/lower-case hex))))

(def style-classes
  "The CSS class for each font style."
  {:bold "repl-input-bold"
   :italic "repl-input-italic"
   :underline "repl-input-underline"
   :strikethrough "repl-input-strikethrough"})

(def font-style-css
  "The CSS rules that give the font style classes their styles."
  [".repl-input-bold { font-weight: bold; }"
   ".repl-input-italic { font-style: italic; }"
   ".repl-input-underline { text-decoration: underline; text-underline-position: under; }"
   ".repl-input-strikethrough { text-decoration: line-through; }"
   ".repl-input-underline.repl-input-strikethrough { text-decoration: underline line-through; text-underline-position: under; }"])

(defn look-class
  "Returns the CSS classes for `color` and the font `styles`, like `#{:italic}`, or nil when neither has one."
  [color styles]
  (some->> (cons (color-class color) (keep style-classes (sort styles)))
           (remove nil?)
           seq
           (str/join " ")))

(defn typed-quote
  "Returns `:step-over` when a quote typed at `offset` lands on the quote that closes a string in
   `text`, `:insert` when it lands elsewhere in a string, and nil outside strings."
  [text offset]
  (when-let [string-end (some (fn [[from to class-name]]
                                (when (and (= "hljs-string" class-name) (< from offset to))
                                  to))
                              (highlight-ranges text))]
    (if (and (= offset (dec string-end)) (= "\"" (get text offset)))
      :step-over
      :insert)))
