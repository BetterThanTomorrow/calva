(ns calva.docs.compare
  "Compares a built site with the reference site, as a reader sees them."
  (:require [clojure.java.io :as io]
            [clojure.set :as set]
            [clojure.string :as string])
  (:import [java.io File]
           [java.net URI]
           [org.jsoup Jsoup]
           [org.jsoup.nodes Element Node TextNode]))

(defn page-urls
  "Returns the URLs of the pages in the site in `dir`."
  [dir]
  (let [root (.toPath (io/file dir))]
    (set (for [^File f (file-seq (io/file dir))
               :when (= "index.html" (.getName f))
               :let [path (str (.relativize root (.toPath (.getParentFile f))))]]
           (if (= "" path) "" (str path "/"))))))

(defn nav-entries
  "Returns the primary nav of the page at `url` in the site in `dir`, as label and
  resolved href pairs. The table of contents is left out."
  [dir url]
  (let [doc (Jsoup/parse (io/file dir url "index.html"))
        base (URI. (str "/" url))]
    (vec (for [^Element el (.select doc (str ".md-nav--primary a.md-nav__link,"
                                             " .md-nav--primary label.md-nav__link[for^=__nav]"))
               :when (nil? (.closest el ".md-nav--secondary"))]
           [(.text el) (some->> (not-empty (.attr el "href")) (.resolve base) str)]))))

(defn headings
  "Returns the article headings of the page at `url` in the site in `dir`, as text and id pairs."
  [dir url]
  (let [doc (Jsoup/parse (io/file dir url "index.html"))]
    (.remove (.select doc "a.headerlink"))
    (mapv (fn [^Element el] [(.text el) (.id el)])
          (.select doc "article h1, article h2, article h3, article h4, article h5, article h6"))))

(defn toc
  "Returns the skip link target, the table of contents as depth, text and href triples, and
  the element names in the active nav item of the page at `url` in the site in `dir`."
  [dir url]
  (let [doc (Jsoup/parse (io/file dir url "index.html"))
        depth (fn [^Element a]
                (count (filter #(= "li" (.tagName ^Element %)) (.parents a))))]
    {:toc/skip (some-> (.selectFirst doc "a.md-skip") (.attr "href"))
     :toc/entries (mapv (fn [^Element a] [(depth a) (.text a) (.attr a "href")])
                        (.select doc ".md-sidebar--secondary a.md-nav__link"))
     :toc/active-item (some->> (.selectFirst doc ".md-nav__item--active:has(> #__toc)")
                               (.children)
                               (mapv #(.tagName ^Element %)))}))

(defn- code-elements [dir url]
  (.select (Jsoup/parse (io/file dir url "index.html")) "article pre > code"))

(defn code-texts
  "Returns the text of each code block in the article of the page at `url` in the site in `dir`."
  [dir url]
  (mapv #(.wholeText ^Element %) (code-elements dir url)))

(def ^:private color-groups
  "Material's code colors, by the token classes its stylesheet gives each one."
  (into {} (for [[group classes] {:operator "o ow" :punctuation "p" :string "cpf l s s1 s2 sb sc si ss"
                                  :special "cp se sh sr sx" :number "il m mb mf mh mi mo"
                                  :keyword "k kd kn kp kr kt nd ni nl nt" :name "kc n"
                                  :constant "bp nb no" :function "nc ne nf nn"
                                  :comment "c c1 ch cm cs sd" :variable "na nv vc vg vi"
                                  :generic "ge gh go gp gr gs gt gu"}
                 class (string/split classes #" ")]
             [class group])))

(defn- char-colors [^Element code]
  (vec (mapcat (fn [^Node node]
                 (let [text (if (instance? TextNode node) (.getWholeText ^TextNode node) (.wholeText ^Element node))
                       group (when (instance? Element node) (color-groups (.className ^Element node)))]
                   (for [c text :when (not (Character/isWhitespace ^char c))] group)))
               (.childNodes code))))

(defn color-differences
  "Returns how many code characters on the pages in `urls` get a different Material color in
  the site in `dir` than in `reference-dir`, of how many, and the blocks that differ most, as
  url, block index and differing character count. Blocks whose text differs are left out."
  [dir reference-dir urls]
  (let [blocks (for [url urls
                     [i code reference] (map vector (range) (code-elements dir url) (code-elements reference-dir url))
                     :let [colors (char-colors code) reference-colors (char-colors reference)]
                     :when (= (count colors) (count reference-colors))]
                 [url i (count colors) (count (remove true? (map = colors reference-colors)))])]
    {:colors/chars (reduce + (map #(nth % 2) blocks))
     :colors/differ (reduce + (map peek blocks))
     :colors/worst (->> blocks (sort-by peek >) (take 10) (mapv (fn [[url i _ n]] [url i n])))}))

(defn- differing-pages [f dir reference-dir urls]
  (sort (for [url urls
              :when (not= (f dir url) (f reference-dir url))]
          url)))

(defn compare-sites
  "Returns the page URLs found in only one of the sites in `dir` and `reference-dir`,
  and the URLs of the pages whose nav, headings, table of contents or code text differ."
  [dir reference-dir]
  (let [urls (page-urls dir)
        reference-urls (page-urls reference-dir)
        shared (set/intersection urls reference-urls)]
    {:compare/only-built (set/difference urls reference-urls)
     :compare/only-reference (set/difference reference-urls urls)
     :compare/nav-differs (differing-pages nav-entries dir reference-dir shared)
     :compare/headings-differ (differing-pages headings dir reference-dir shared)
     :compare/toc-differs (differing-pages toc dir reference-dir shared)
     :compare/code-differs (differing-pages code-texts dir reference-dir shared)}))

(comment
  (compare-sites "../.tmp/site" "../.tmp/reference-site")
  (nav-entries "../.tmp/site" "api/")
  :rcf)
