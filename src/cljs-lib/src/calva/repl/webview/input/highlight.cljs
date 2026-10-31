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

(defn layered
  "Returns `[from to color]` for each run of one color, from the `grammar` ranges with the `semantic` ranges
   over them."
  [grammar semantic]
  (let [ranges (concat grammar semantic)
        colors (reduce (fn [colors [from to color]]
                         (reduce #(assoc! %1 %2 color) colors (range from to)))
                       (transient (vec (repeat (reduce max 0 (map second ranges)) nil)))
                       ranges)]
    (->> (persistent! colors)
         (map-indexed vector)
         (partition-by second)
         (keep (fn [run]
                 (let [[from color] (first run)]
                   (when color
                     [from (inc (first (last run))) color]))))
         vec)))

(defn mapped
  "Returns `ranges` with their ends moved by `map-pos`, as CodeMirror's `mapPos`, without the ranges that
   end up empty."
  [ranges map-pos]
  (vec (keep (fn [[from to color]]
               (let [from (map-pos from 1)
                     to (map-pos to -1)]
                 (when (< from to)
                   [from to color])))
             ranges)))

(defn color-class
  "Returns the CSS class for the hex `color`, like `#ff7b72`, or nil for any other color."
  [color]
  (when-let [[_ hex] (re-matches #"#([0-9a-fA-F]{3,8})" (str color))]
    (str "repl-input-color-" (str/lower-case hex))))

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
