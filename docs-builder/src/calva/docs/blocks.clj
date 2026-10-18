(ns calva.docs.blocks
  "Splits a page's Markdown into Material's block types and the Markdown around them,
  and gives the rendered blocks Material's markup."
  (:require [clojure.string :as string]
            [hiccup2.core :as h]))

(defn- block-head [line]
  (if-let [[_ marker qualifier title] (re-matches #"(!!!|\?\?\?\+?) +(\w+)(?: +\"(.*)\")? *" line)]
    (cond-> {:block/type (if (= "!!!" marker) :admonition :details)
             :block/qualifier (string/lower-case qualifier)
             :block/title (or title (string/capitalize qualifier))}
      (not= "!!!" marker) (assoc :block/open? (= "???+" marker)))
    (when-let [[_ title] (re-matches #"=== +\"(.*)\" *" line)]
      {:block/type :tab :block/title title})))

(defn- next-fence [fence line]
  (let [marker (second (re-matches #" {0,3}(`{3,}|~{3,}).*" line))]
    (cond
      (nil? fence) marker
      (and marker
           (string/starts-with? marker fence)
           (string/blank? (subs (string/trim line) (count marker)))) nil
      :else fence)))

(defn- body-end
  "Returns the index after the indented body that starts at `start`, leaving out trailing blank lines."
  [lines start]
  (loop [i start end start]
    (cond
      (= i (count lines)) end
      (string/blank? (lines i)) (recur (inc i) end)
      (string/starts-with? (lines i) "    ") (recur (inc i) (inc i))
      :else end)))

(defn- dedent [lines]
  (string/join "\n" (map #(if (string/blank? %) "" (subs % 4)) lines)))

(defn- conj-markdown [blocks run]
  (if (every? string/blank? run)
    blocks
    (conj blocks {:block/type :markdown :block/markdown (string/join "\n" run)})))

(defn- block-at
  "Returns the block whose head is line `i`, and the index after its body. Returns nil when
  line `i` is no block head, or is inside a code `fence`."
  [lines i fence]
  (when-let [head (when-not fence (some-> (get lines i) block-head))]
    (let [end (body-end lines (inc i))]
      [(assoc head :block/markdown (dedent (subvec lines (inc i) end))) end])))

(defn- split-blocks [lines]
  (loop [i 0 fence nil run [] blocks []]
    (let [[block end] (block-at lines i fence)]
      (cond
        (= i (count lines)) (conj-markdown blocks run)
        block (recur end nil [] (conj (conj-markdown blocks run) block))
        :else (recur (inc i) (next-fence fence (lines i)) (conj run (lines i)) blocks)))))

(defn- tab? [block]
  (= :tab (:block/type block)))

(defn page-blocks
  "Returns the page `markdown` as a vector of blocks: admonitions, details, tab sets,
  and the Markdown between them."
  [markdown]
  (into []
        (mapcat (fn [group]
                  (if (tab? (first group))
                    [{:block/type :tabs :block/tabs (mapv #(dissoc % :block/type) group)}]
                    group)))
        (partition-by tab? (split-blocks (string/split-lines markdown)))))

(defn- tab-set [n {:block/keys [tabs]}]
  (let [tab-id #(str "__tabbed_" n "_" (inc %))]
    [:div.tabbed-set.tabbed-alternate {:data-tabs (str n ":" (count tabs))}
     (for [i (range (count tabs))]
       [:input {:type "radio" :name (str "__tabbed_" n) :id (tab-id i) :checked (zero? i)}])
     [:div.tabbed-labels
      (map-indexed (fn [i {:block/keys [title-html]}]
                     [:label {:for (tab-id i)} (h/raw title-html)])
                   tabs)]
     [:div.tabbed-content
      (for [{:block/keys [html]} tabs]
        [:div.tabbed-block (h/raw html)])]]))

(defn- block-hiccup [{:block/keys [type qualifier title title-html html open?] :as block} tab-set-n]
  (case type
    :markdown (h/raw html)
    :admonition [:div {:class ["admonition" qualifier]}
                 (when (seq title) [:p.admonition-title (h/raw title-html)])
                 (h/raw html)]
    :details [:details {:class qualifier :open open?}
              [:summary (h/raw title-html)]
              (h/raw html)]
    :tabs (tab-set tab-set-n block)))

(defn page-body
  "Returns the hiccup for the rendered `blocks`. Tab sets are numbered from 1, in page order."
  [blocks]
  (map block-hiccup blocks (reductions + (map #(if (= :tabs (:block/type %)) 1 0) blocks))))
