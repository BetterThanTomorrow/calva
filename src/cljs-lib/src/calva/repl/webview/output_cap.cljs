(ns calva.repl.webview.output-cap
  "How much output an Output view page keeps, and which output blocks the cap removes.")

(def default-max-output-characters
  "The most characters of output an Output view page keeps without the setting
   `calva.outputViews.maxOutputCharacters`."
  1000000)

(defn current-output-cap
  "Returns the output cap of the page, its `data-max-output-characters`. 0 keeps all output."
  []
  (let [cap (some-> (.. js/document -body (getAttribute "data-max-output-characters")) js/Number)]
    (if (and (number? cap) (js/isFinite cap)) cap default-max-output-characters)))

(defn kept-block-count
  "Returns how many of the newest output blocks fit `cap` characters by their text `lengths`, newest first,
   and at least one."
  [lengths cap]
  (max 1 (count (take-while #(<= % cap) (reductions + lengths)))))

(defn error-ids
  "Returns the ids of the errors in the output `blocks`."
  [blocks]
  (keep (fn [^js block]
          (some-> (if (.hasAttribute block "data-error-id") block (.querySelector block "[data-error-id]"))
                  (.getAttribute "data-error-id")))
        blocks))

(defn in-removed?
  "True when `node` is one of the `removed` blocks, a JS Set, or inside one."
  [^js removed ^js node]
  (loop [^js n node]
    (cond
      (nil? n) false
      (.has removed n) true
      :else (recur (.-parentNode n)))))

(defn- text-length
  [^js block]
  (count (.-textContent block)))

(defn removed-blocks
  "Returns the oldest of the output `blocks` that don't fit `cap` characters, except the `kept` block, and the
   index of the oldest block the cap keeps. A `cap` of 0 keeps every block."
  [blocks cap kept]
  (let [kept-count (if (pos? cap)
                     (kept-block-count (map text-length (rseq blocks)) cap)
                     (count blocks))
        oldest-kept (- (count blocks) kept-count)]
    [(into [] (remove #(identical? % kept)) (subvec blocks 0 oldest-kept))
     oldest-kept]))

(defn holds-focus?
  "True when one of the output `blocks` holds the focus."
  [blocks]
  (some #(.contains ^js % js/document.activeElement) blocks))

(defn removed-state
  "Returns what the page forgets for the removed output `blocks`: their `:code-ids` and `:folded-ids`, and
   `:removed?`, true for a node in one of them."
  [blocks]
  {:removed? (partial in-removed? (js/Set. (into-array blocks)))
   :code-ids (set (for [^js block blocks
                        ^js code (array-seq (.querySelectorAll block "code"))
                        :let [id (.. code -dataset -codeId)]
                        :when id]
                    id))
   :folded-ids (keep #(.getAttribute ^js % "data-folded-id") blocks)})

(defn without-keys
  "Returns `m` without the `ks`."
  [m ks]
  (apply dissoc m ks))

(defn without-code-requests
  "Returns the waiting semantic token `requests` without those for the code with `code-ids`, a request's key
   being the code id, `@`, and a count."
  [{:keys [codes] :as requests} code-ids]
  (assoc requests :codes (into [] (remove (fn [[request-key]] (contains? code-ids (first (.split request-key "@"))))) codes)))

(defn without-removed
  "Returns the `entries` whose node, by `node-of`, isn't `removed?`."
  [entries removed? node-of]
  (into [] (remove (comp removed? node-of)) entries))

(defn without-removed-waiters
  "Returns the local image `lookups` without the waiters for removed images, `[img thumbnail]` each."
  [lookups removed?]
  (update-vals lookups #(update % :waiters without-removed removed? first)))
