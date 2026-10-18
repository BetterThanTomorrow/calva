(ns calva.docs.markdown
  "Docs pages from Markdown source: front matter, HTML, and heading ids."
  (:require [calva.docs.highlight :as highlight]
            [clojure.string :as string]
            [hiccup2.core :as h])
  (:import [java.text Normalizer Normalizer$Form]
           [org.commonmark.ext.gfm.tables TablesExtension]
           [org.commonmark.node Code FencedCodeBlock Heading Image IndentedCodeBlock Link Node Text]
           [org.commonmark.parser Parser]
           [org.commonmark.renderer NodeRenderer]
           [org.commonmark.renderer.html AttributeProvider AttributeProviderFactory HtmlNodeRendererContext
            HtmlNodeRendererFactory HtmlRenderer]))

(def ^:private extensions [(TablesExtension/create)])

(def ^:private parser (-> (Parser/builder) (.extensions extensions) .build))

(defn- code-renderer [^HtmlNodeRendererContext context]
  (reify NodeRenderer
    (getNodeTypes [_] #{FencedCodeBlock IndentedCodeBlock})
    (render [_ node]
      (let [language (when (instance? FencedCodeBlock node)
                       (re-find #"\S+" (or (.getInfo ^FencedCodeBlock node) "")))
            source (if (instance? FencedCodeBlock node)
                     (.getLiteral ^FencedCodeBlock node)
                     (.getLiteral ^IndentedCodeBlock node))]
        (.raw (.getWriter context) (str (h/html (highlight/code-block language source))))))))

(defn- html-renderer
  "Returns a renderer that gives the heading nodes in `ids` their id, and the
  `permalinks` nodes the `headerlink` class. Code blocks are highlighted."
  [ids permalinks]
  (let [provider (reify AttributeProvider
                   (setAttributes [_ node _tag attrs]
                     (when-let [id (ids node)] (.put attrs "id" id))
                     (when (permalinks node) (.put attrs "class" "headerlink"))))]
    (-> (HtmlRenderer/builder)
        (.extensions extensions)
        (.attributeProviderFactory (reify AttributeProviderFactory (create [_ _] provider)))
        (.nodeRendererFactory (reify HtmlNodeRendererFactory (create [_ context] (code-renderer context))))
        .build)))

(defn- children [^Node node]
  (take-while some? (iterate #(.getNext ^Node %) (.getFirstChild node))))

(defn- nodes [^Node node]
  (tree-seq #(.getFirstChild ^Node %) children node))

(defn- plain-text [node]
  (apply str (keep #(condp instance? %
                      Text (.getLiteral ^Text %)
                      Code (.getLiteral ^Code %)
                      nil)
                   (nodes node))))

(defn- slug [text]
  (-> (Normalizer/normalize text Normalizer$Form/NFKD)
      (string/replace #"[^\x00-\x7F]" "")
      (string/replace #"[^\w\s-]" "")
      string/trim
      string/lower-case
      (string/replace #"[-\s]+" "-")))

(defn- relink! [href-fn node]
  (condp instance? node
    Link (.setDestination ^Link node (href-fn (.getDestination ^Link node)))
    Image (.setDestination ^Image node (href-fn (.getDestination ^Image node)))
    nil))

(defn- unique-id [ids id]
  (if (or (contains? ids id) (string/blank? id))
    (recur ids (if-let [[_ base n] (re-matches #"(.*)_(\d+)" id)]
                 (str base "_" (inc (parse-long n)))
                 (str id "_1")))
    id))

(defn heading-ids
  "Returns the ids for headings with the `texts`, in page order. Repeated and empty
  ids get numbered suffixes, so the ids are unique on the page."
  [texts]
  (first (reduce (fn [[out ids] text]
                   (let [id (unique-id ids (slug text))]
                     [(conj out id) (conj ids id)]))
                 [[] #{}]
                 texts)))

(defn- parse [markdown href-fn]
  (let [doc (.parse parser markdown)]
    (run! #(relink! href-fn %) (nodes doc))
    doc))

(defn- add-permalink! [^Heading heading id]
  (let [link (doto (Link. (str "#" id) "Permanent link") (.appendChild (Text. "#")))]
    (.appendChild heading link)
    link))

(defn- parse-block [href-fn {:block/keys [markdown title tabs] :as block}]
  (cond-> block
    markdown (assoc :block/doc (parse markdown href-fn))
    title (assoc :block/title-doc (parse title href-fn))
    tabs (assoc :block/tabs (mapv #(parse-block href-fn %) tabs))))

(defn- block-docs [{:block/keys [doc tabs]}]
  (cons doc (mapcat block-docs tabs)))

(defn- inline-html [^HtmlRenderer renderer ^Node doc]
  (apply str (map #(.render renderer %) (some-> doc .getFirstChild children))))

(defn- render-block [^HtmlRenderer renderer {:block/keys [doc title-doc tabs] :as block}]
  (cond-> (dissoc block :block/markdown :block/doc :block/title-doc)
    doc (assoc :block/html (.render renderer doc))
    title-doc (assoc :block/title-html (inline-html renderer title-doc))
    tabs (assoc :block/tabs (mapv #(render-block renderer %) tabs))))

(defn- block-nodes
  "Returns the top-level nodes of `block` and its tabs, in page order, with each title first."
  [{:block/keys [doc title-doc tabs]}]
  (concat (some-> title-doc children) (some-> doc children) (mapcat block-nodes tabs)))

(defn- join-html [html more]
  (if (string/blank? html) more (str html " " more)))

(defn- add-to-sections
  "Returns a reducing function that starts a section at each node in `headings`, and adds the
  HTML of other nodes to the current section."
  [^HtmlRenderer renderer headings permalinks]
  (fn [sections ^Node node]
    (if-let [{:heading/keys [id level]} (headings node)]
      (conj sections {:section/id id
                      :section/level level
                      :section/title-html (apply str (map #(.render renderer %) (remove permalinks (children node))))
                      :section/html ""})
      (update-in sections [(dec (count sections)) :section/html] join-html (string/trim (.render renderer node))))))

(defn render-blocks
  "Renders the Markdown bodies and titles of `blocks` as `:block/html` and
  `:block/title-html`, with link and image destinations passed through `href-fn`.
  Headings get unique ids and permalinks. Returns the rendered blocks as
  `:page/blocks`, the headings, in page order, as `:page/headings`, and the text
  before the first heading and under each heading as `:page/sections`."
  [blocks href-fn]
  (let [blocks (mapv #(parse-block href-fn %) blocks)
        heading-nodes (filter #(instance? Heading %)
                              (mapcat nodes (keep identity (mapcat block-docs blocks))))
        headings (mapv (fn [^Heading node id]
                         {:heading/level (.getLevel node) :heading/id id :heading/text (plain-text node)})
                       heading-nodes
                       (heading-ids (map plain-text heading-nodes)))
        ids (map :heading/id headings)
        permalinks (set (map add-permalink! heading-nodes ids))
        renderer (html-renderer (zipmap heading-nodes ids) permalinks)]
    {:page/blocks (mapv #(render-block renderer %) blocks)
     :page/headings headings
     :page/sections (reduce (add-to-sections renderer (zipmap heading-nodes headings) permalinks)
                            [{:section/html ""}]
                            (mapcat block-nodes blocks))}))

(defn- unquoted [s]
  (if-let [[_ inner] (re-matches #"\"(.*)\"" s)]
    inner
    s))

(defn- front-matter-entry
  [[section entries] line]
  (if-let [[_ indent k v] (re-matches #"( *)([\w-]+):\s*(.*)" line)]
    (cond
      (string/blank? v) [k entries]
      (seq indent) [section (assoc entries (keyword section k) (unquoted v))]
      :else [section (assoc entries (keyword "page" k) (unquoted v))])
    (throw (ex-info "Front matter line is not `key: value`" {:front-matter/line line}))))

(defn front-matter
  "Returns the front matter `text` as a flat map. Top-level keys get the `page` namespace, and keys indented under `section:` get the `section` namespace."
  [text]
  (second (reduce front-matter-entry [nil {}] (string/split-lines text))))

(defn page-parts
  "Returns the page `source` as its front matter entries plus `:page/markdown`."
  [source]
  (if-let [[_ text body] (re-matches #"(?s)---\n(.*?)\n---\n(.*)" source)]
    (assoc (front-matter text) :page/markdown body)
    {:page/markdown source}))

(comment
  (dissoc (page-parts (slurp "../docs/site/api.md")) :page/markdown)
  (render-blocks [{:block/type :markdown :block/markdown "# Hi `there`\n\nSee [j](joyride.md)"}
                  {:block/type :admonition :block/title "A `title`" :block/markdown "Body"}]
                 #(str "../" %))
  :rcf)
