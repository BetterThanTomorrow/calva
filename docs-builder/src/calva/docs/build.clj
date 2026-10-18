(ns calva.docs.build
  "Reads the docs sources, renders the site as a map of output files, and writes it."
  (:require [calva.docs.markdown :as markdown]
            [calva.docs.shell :as shell]
            [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.string :as string]))

(defn nav-sources
  "Returns the page source files in `nav`, in nav order."
  [nav]
  (->> nav flatten (filter #(string/ends-with? % ".md"))))

(defn read-site
  "Returns the site config under `root`, with its nav pages as `:site/pages`."
  [{:build/keys [root]}]
  (let [config (edn/read-string (slurp (io/file root "docs/calva-docs.edn")))
        read-page (fn [src]
                    (assoc (markdown/page-parts (slurp (io/file root "docs/site" src)))
                           :page/src src))]
    (assoc config :site/pages (mapv read-page (nav-sources (:site/nav config))))))

(defn page-url
  "Returns the site-relative URL for the page source file `src`."
  [src]
  (if (= "index.md" src)
    ""
    (str (string/replace src #"\.md$" "") "/")))

(defn render-site
  "Returns `site` as a map from output path to file content."
  [{:site/keys [pages] :as site}]
  (into {}
        (for [{:page/keys [src] :as page} pages]
          [(str (page-url src) "index.html") (shell/page-html site page)])))

(defn- delete-tree! [dir]
  (doseq [f (reverse (file-seq (io/file dir)))]
    (io/delete-file f true)))

(defn write-site!
  "Replaces the contents of `out-dir` with `files`, a map from output path to content."
  [{:build/keys [out-dir]} files]
  (delete-tree! out-dir)
  (doseq [[path content] files]
    (let [f (io/file out-dir path)]
      (io/make-parents f)
      (spit f content)))
  {:build/out-dir out-dir
   :build/file-count (count files)})

(defn build!
  "Builds the site from `root` into `out-dir`. Returns a summary of what was written."
  [options]
  (let [start (System/nanoTime)
        files (render-site (merge (read-site options) options))]
    (assoc (write-site! options files)
           :build/ms (quot (- (System/nanoTime) start) 1000000))))

(comment
  (build! {:build/root ".." :build/out-dir "../.tmp/site" :build/live-reload? true})
  :rcf)
