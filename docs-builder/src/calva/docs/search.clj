(ns calva.docs.search
  "Material's search index for the docs pages, with an entry per page and per heading."
  (:require [clojure.data.json :as json]
            [clojure.string :as string]))

(defn- unescape-quotes
  "Returns `html` with plain quote characters, so that the search splits quoted words like other words."
  [html]
  (string/replace html #"&quot;|&apos;|&#39;" #(if (= "&quot;" %) "\"" "'")))

(defn- search-text
  "Returns `html` with the tags Material's search results show, and the text of the others."
  [html]
  (-> html
      (string/replace #"(?s)<!--.*?-->" "")
      (string/replace #"</?(?!(?:p|code|ul|ol|li|pre)\b)[a-zA-Z][^>]*>" "")
      (string/replace #"<p>\s*</p>\s?" "")
      unescape-quotes
      string/trim))

(defn page-entries
  "Returns the search entries for `page`. The page entry is its H1 section when the page opens
  with its H1, and otherwise the text before the first heading, titled by the page title."
  [{:page/keys [url title sections] boost :search/boost}]
  (let [[{:section/keys [html]} {:section/keys [level] :as first-heading} & more :as sections] sections
        [page-section heading-sections] (if (and (string/blank? html) (= 1 level))
                                          [first-heading more]
                                          [{:section/title-html title :section/html html} (rest sections)])]
    (for [[location {:section/keys [title-html html]}]
          (cons [url page-section] (map (juxt #(str url "#" (:section/id %)) identity) heading-sections))]
      (cond-> {:location location :title (unescape-quotes title-html) :text (search-text html)}
        boost (assoc :boost (parse-double boost))))))

(defn search-index
  "Returns the search index for `pages` as JSON, with words split by `separator`."
  [separator pages]
  (json/write-str {:config {:lang ["en"] :separator separator :pipeline ["stopWordFilter"]}
                   :docs (mapcat page-entries pages)}))
