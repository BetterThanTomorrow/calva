(ns calva.docs.url
  "Site URLs for pages, and hrefs between them."
  (:require [clojure.string :as string]))

(defn page-url
  "Returns the site-relative URL for the page source file `src`."
  [src]
  (if (= "index.md" src)
    ""
    (str (string/replace src #"\.md$" "") "/")))

(defn- depth [from-url]
  (count (re-seq #"/" from-url)))

(defn site-root
  "Returns the site root relative to the page at `from-url`."
  [from-url]
  (if (zero? (depth from-url))
    "."
    (string/join "/" (repeat (depth from-url) ".."))))

(defn site-href
  "Returns the href from the page at `from-url` to the site path `path`."
  [from-url path]
  (let [href (str (string/join (repeat (depth from-url) "../")) path)]
    (if (string/blank? href) "./" href)))

(defn content-href
  "Returns `href`, written in the page at `from-url`, as an href in the built site.
  Relative hrefs to `.md` files point at their pages. Other hrefs are unchanged."
  [from-url href]
  (if-let [[_ path suffix] (re-matches #"(?:\./)?([^:#?/][^:#?]*)([#?].*)?" href)]
    (str (site-href from-url (if (string/ends-with? path ".md") (page-url path) path))
         suffix)
    href))
