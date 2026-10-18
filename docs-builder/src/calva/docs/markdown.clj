(ns calva.docs.markdown
  "Docs pages from Markdown source: front matter and HTML."
  (:require [clojure.string :as string])
  (:import [org.commonmark.ext.gfm.tables TablesExtension]
           [org.commonmark.node Code Heading Image Link Node Text]
           [org.commonmark.parser Parser]
           [org.commonmark.renderer.html HtmlRenderer]))

(def ^:private extensions [(TablesExtension/create)])

(def ^:private parser (-> (Parser/builder) (.extensions extensions) .build))

(def ^:private renderer (-> (HtmlRenderer/builder) (.extensions extensions) .build))

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

(defn- h1? [node]
  (and (instance? Heading node) (= 1 (.getLevel ^Heading node))))

(defn- relink! [href-fn node]
  (condp instance? node
    Link (.setDestination ^Link node (href-fn (.getDestination ^Link node)))
    Image (.setDestination ^Image node (href-fn (.getDestination ^Image node)))
    nil))

(defn render
  "Returns the HTML for the CommonMark `markdown` as `:page/html`, with link and image
  destinations passed through `href-fn`, and the text of its first H1 as `:page/h1`."
  [markdown href-fn]
  (let [doc (.parse parser markdown)
        all (nodes doc)]
    (run! #(relink! href-fn %) all)
    {:page/html (.render renderer doc)
     :page/h1 (some->> all (filter h1?) first plain-text)}))

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
  (render "# Hi `there`\n\nSee [j](joyride.md)\n\n| a | b |\n|---|---|\n| 1 | 2 |" #(str "../" %))
  :rcf)
