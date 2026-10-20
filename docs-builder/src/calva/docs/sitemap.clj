(ns calva.docs.sitemap
  "The sitemap of the docs pages, plain and gzipped."
  (:require [hiccup2.core :as h])
  (:import [java.io ByteArrayOutputStream]
           [java.util.zip GZIPOutputStream]))

(defn- gzip [^String s]
  (let [out (ByteArrayOutputStream.)]
    (with-open [gz (GZIPOutputStream. out)]
      (.write gz (.getBytes s "UTF-8")))
    (.toByteArray out)))

(defn sitemap-files
  "Returns `sitemap.xml` and `sitemap.xml.gz` for the pages at `urls` on the site at `site-url`."
  [site-url urls]
  (let [xml (str "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                 (h/html {:mode :xml}
                         [:urlset {:xmlns "http://www.sitemaps.org/schemas/sitemap/0.9"}
                          (for [url urls] [:url [:loc (str site-url "/" url)]])]))]
    {"sitemap.xml" xml
     "sitemap.xml.gz" (gzip xml)}))
