(ns calva.docs.build
  "Reads the docs sources, renders the site as a map of output files, and writes it."
  (:require [calva.docs.blocks :as blocks]
            [calva.docs.markdown :as markdown]
            [calva.docs.search :as search]
            [calva.docs.shell :as shell]
            [calva.docs.sitemap :as sitemap]
            [calva.docs.toc :as toc]
            [calva.docs.url :as url]
            [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.string :as string])
  (:import [java.io File]))

(def ^:private material-dir "docs-builder/vendor/material-9.5.16")

(defn nav-sources
  "Returns the page source files in `nav`, in nav order."
  [nav]
  (->> nav flatten (filter #(string/ends-with? % ".md"))))

(defn- tree-files
  "Returns the files at or under `from`, skipping dotfiles, as a map from their path under `to` to the file."
  [^File from to]
  (into {}
        (for [^File f (file-seq from)
              :when (and (.isFile f) (not (string/starts-with? (.getName f) ".")))]
          [(str to (subs (.getPath f) (count (.getPath from)))) f])))

(defn- read-assets [root static]
  (apply merge
         (tree-files (io/file root material-dir "stylesheets") "assets/stylesheets")
         (tree-files (io/file root material-dir "javascripts") "assets/javascripts")
         (for [path static]
           (tree-files (io/file root "docs/site" path) path))))

(defn- read-scripts
  "Returns the `names`d scripts in `dir` as `:script/<name>` entries."
  [dir names]
  (into {} (for [script-name names]
             [(keyword "script" script-name)
              (string/trim (slurp (io/file dir (str script-name ".js"))))])))

(defn read-site
  "Returns the site config under `root`, merged with the Material shell data and
  scripts, the static files as `:site/assets`, and the nav pages as `:site/pages`."
  [{:build/keys [root]}]
  (let [config (edn/read-string (slurp (io/file root "docs/calva-docs.edn")))
        shell-dir (io/file root material-dir "shell")
        read-page (fn [src]
                    (assoc (markdown/page-parts (slurp (io/file root "docs/site" src)))
                           :page/src src))]
    (merge config
           (edn/read-string (slurp (io/file shell-dir "shell.edn")))
           (read-scripts shell-dir ["md-helpers" "palette" "tabs-restore" "hash-target" "analytics"])
           {:site/assets (read-assets root (:site/static config))
            :site/pages (mapv read-page (nav-sources (:site/nav config)))})))

(defn- with-content [{:page/keys [src markdown title] :as page}]
  (let [page-url (url/page-url src)
        {:page/keys [blocks headings sections]} (markdown/render-blocks (blocks/page-blocks markdown)
                                                                        #(url/content-href page-url %))
        h1 (some #(when (= 1 (:heading/level %)) (:heading/text %)) headings)]
    (assoc page
           :page/url page-url
           :page/title (or title h1 src)
           :page/h1 h1
           :page/headings headings
           :page/sections sections
           :page/toc (toc/page-toc headings)
           :page/body (blocks/page-body blocks))))

(defn- with-neighbors [pages]
  (mapv (fn [prev page next]
          (assoc page :page/prev-url (:page/url prev) :page/next-url (:page/url next)))
        (cons nil pages)
        pages
        (concat (rest pages) [nil])))

(def ^:private not-found-page
  {:page/url "/"
   :page/h1 "404 - Not found"
   :page/body (list [:h1 "404 - Not found"])})

(defn render-site
  "Returns `site` as a map from output path to file content, a string, bytes, or a file to copy."
  [{site-url :site/url :site/keys [pages assets] :search/keys [separator] :as site}]
  (let [pages (with-neighbors (mapv with-content pages))
        site (assoc site :site/pages-by-src (into {} (map (juxt :page/src identity)) pages))]
    (merge assets
           (into {} (for [{:page/keys [url] :as page} pages]
                      [(str url "index.html") (shell/page-html site page)]))
           {"404.html" (shell/page-html site not-found-page)
            "search/search_index.json" (search/search-index separator pages)}
           (sitemap/sitemap-files site-url (map :page/url pages)))))

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
      (io/copy content f)))
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
