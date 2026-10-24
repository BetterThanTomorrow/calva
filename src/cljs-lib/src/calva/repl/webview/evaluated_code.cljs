(ns calva.repl.webview.evaluated-code
  "The Output view's evaluated code blocks of REPL Input evaluations: each carries its evaluation's id,
   and a block is revealed by id with its definition marked.")

(def highlight-name "repl-input-definition")

(defn- code-position
  "Returns where `line` and `column`, as the REPL reports them, are in the code of `block`, which starts
   at the zero-based line and column it was evaluated at: the zero-based line and character in the code."
  [{:repl-input.evaluation/keys [line column] :as _block} reported]
  (let [code-line (- (:line reported) 1 line)]
    {:line code-line
     :character (- (or (:column reported) 1) 1 (if (zero? code-line) column 0))}))

(defn definition-range
  "Returns the offsets in `code` of `block` from the definition at `reported`, the line and column the
   REPL reports, to the end of its line, or nil when the definition is outside the code."
  [code block reported]
  (let [{:keys [line character]} (code-position block reported)
        lines (.split code "\n")]
    (when (< -1 line (count lines))
      (let [line-start (reduce + (map #(inc (count %)) (take line lines)))
            line-end (+ line-start (count (aget lines line)))]
        [(min line-end (+ line-start (max 0 character))) line-end]))))

(defn set-evaluation-id!
  "Gives the evaluated code block `element` the id of its evaluation and where its code starts."
  [^js element {:repl-input.evaluation/keys [id line column]}]
  (let [dataset (.-dataset element)]
    (set! (.-evaluationId dataset) (str id))
    (set! (.-evaluationLine dataset) (str line))
    (set! (.-evaluationColumn dataset) (str column))))

(defn- block-element
  [^js root id]
  (.querySelector root (str "[data-evaluation-id=\"" id "\"]")))

(defn- dataset-block
  [^js element]
  (let [dataset (.-dataset element)]
    {:repl-input.evaluation/line (js/parseInt (.-evaluationLine dataset))
     :repl-input.evaluation/column (js/parseInt (.-evaluationColumn dataset))}))

(defn- text-nodes
  "Returns the text nodes in `element`, each with the offset in the text where it starts."
  [^js element]
  (let [walker (js/document.createTreeWalker element js/NodeFilter.SHOW_TEXT)]
    (loop [nodes []
           offset 0]
      (if-let [^js node (.nextNode walker)]
        (recur (conj nodes [node offset]) (+ offset (.-length node)))
        nodes))))

(defn- node-at
  "Returns the text node among `nodes` with `offset`, and the offset in it."
  [nodes offset]
  (some (fn [[^js node start]]
          (when (<= offset (+ start (.-length node)))
            [node (- offset start)]))
        nodes))

(defn- text-range
  "Returns a DOM range over the characters `from` to `to` of the text in `element`."
  [^js element [from to]]
  (let [nodes (text-nodes element)
        [start-node start-offset] (node-at nodes from)
        [end-node end-offset] (node-at nodes to)]
    (when (and start-node end-node)
      (doto (js/document.createRange)
        (.setStart start-node start-offset)
        (.setEnd end-node end-offset)))))

(defn- mark!
  "Marks `range`, or nothing when it is nil, as the definition."
  [range]
  (when (exists? js/CSS.highlights)
    (if range
      (.set js/CSS.highlights highlight-name (js/Highlight. range))
      (.delete js/CSS.highlights highlight-name))))

(defn- scroll-to!
  "Scrolls `range`, or `element` when there is no range, to the middle of the view, once the view shows."
  [^js element range]
  (js/requestAnimationFrame
   (fn []
     (let [rect (.getBoundingClientRect (or range element))]
       (js/window.scrollBy 0 (- (.-top rect) (/ js/window.innerHeight 2)))))))

(defn reveal!
  "Scrolls to the evaluated code block of the evaluation `id` under `root`, and marks the definition at
   `line` and `column` in it, as the REPL reports them. Returns true when the block is there."
  [^js root {:repl-input.evaluation/keys [id] :keys [line column]}]
  (if-let [element (block-element root id)]
    (let [^js code (.querySelector element "code")
          range (some->> (definition-range (.-textContent code) (dataset-block element) {:line line :column column})
                         (text-range code))]
      (mark! range)
      (scroll-to! element range)
      true)
    false))
