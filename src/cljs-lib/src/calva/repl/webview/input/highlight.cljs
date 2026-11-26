(ns calva.repl.webview.input.highlight
  "Highlighting for the REPL Input: the extension's colors from Calva's grammar and clojure-lsp's semantic
   tokens, layered and moved along with the edits, and where its strings are.")

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

(defn- string-end
  "Returns where the string that starts at the quote at `start` in `text` ends, after its closing quote, or the
   end of `text` when it doesn't close."
  [text start]
  (let [n (count text)]
    (loop [i (inc start)]
      (cond
        (>= i n) n
        (= "\\" (nth text i)) (recur (+ i 2))
        (= "\"" (nth text i)) (inc i)
        :else (recur (inc i))))))

(defn- step
  "Returns where reading `text` goes on after the character at `i`, and the string's `[from to]` when one
   starts there. A character literal and a comment are read past."
  [text i]
  (case (nth text i)
    "\\" [(+ i 2) nil]
    ";" (let [line-end (.indexOf text "\n" i)]
          [(if (neg? line-end) (count text) line-end) nil])
    "\"" (let [end (string-end text i)]
           [end [i end]])
    [(inc i) nil]))

(defn string-ranges
  "Returns `[from to]` for each string in `text`, regular expressions included, `to` after its closing quote.
   Leaves out quotes in comments and character literals."
  [text]
  (loop [i 0
         ranges []]
    (if (>= i (count text))
      ranges
      (let [[next-i string] (step text i)]
        (recur next-i (cond-> ranges string (conj string)))))))

(defn typed-quote
  "Returns `:step-over` when a quote typed at `offset` lands on the quote that closes a string in
   `text`, `:insert` when it lands elsewhere in a string, and nil outside strings."
  [text offset]
  (when-let [end (some (fn [[from to]] (when (< from offset to) to)) (string-ranges text))]
    (if (and (= offset (dec end)) (= "\"" (get text offset)))
      :step-over
      :insert)))
