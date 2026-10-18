(ns calva.docs.compare
  "Compares a built site with the reference site, as a reader sees them."
  (:require [clojure.java.io :as io]
            [clojure.set :as set])
  (:import [java.io File]
           [java.net URI]
           [org.jsoup Jsoup]
           [org.jsoup.nodes Element]))

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

(defn compare-sites
  "Returns the page URLs found in only one of the sites in `dir` and `reference-dir`,
  and the URLs of the pages whose nav differs."
  [dir reference-dir]
  (let [urls (page-urls dir)
        reference-urls (page-urls reference-dir)]
    {:compare/only-built (set/difference urls reference-urls)
     :compare/only-reference (set/difference reference-urls urls)
     :compare/nav-differs (sort (for [url (set/intersection urls reference-urls)
                                      :when (not= (nav-entries dir url)
                                                  (nav-entries reference-dir url))]
                                  url))}))

(comment
  (compare-sites "../.tmp/site" "../.tmp/reference-site")
  (nav-entries "../.tmp/site" "api/")
  :rcf)
