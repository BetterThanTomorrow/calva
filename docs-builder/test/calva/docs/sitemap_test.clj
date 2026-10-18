(ns calva.docs.sitemap-test
  (:require [calva.docs.sitemap :as sitemap]
            [clojure.java.io :as io]
            [clojure.test :refer [deftest is]])
  (:import [java.util.zip GZIPInputStream]))

(deftest sitemap-files
  (let [{xml "sitemap.xml" gz "sitemap.xml.gz"} (sitemap/sitemap-files "https://calva.io" ["" "api/"])]
    (is (= (str "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">"
                "<url><loc>https://calva.io/</loc></url><url><loc>https://calva.io/api/</loc></url></urlset>")
           xml))
    (is (= xml (slurp (GZIPInputStream. (io/input-stream gz)))))))
