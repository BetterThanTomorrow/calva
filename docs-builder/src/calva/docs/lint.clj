(ns calva.docs.lint
  "Finds what a reader of the docs would trip on: links to pages and anchors that don't exist,
  and block markup that renders as text."
  (:require [calva.docs.blocks :as blocks]))

(defn- link-problem [pages-by-src page href]
  (when-let [[_ path anchor] (re-matches #"(?:\./)?([^:#?/][^:#?]*\.md)?(?:#(.+))?" href)]
    (let [{:page/keys [src headings]} (if path (pages-by-src path) page)]
      (cond
        (nil? src) (str "links to `" href "`, and " path " is not a page in the nav")
        (and anchor (not-any? #(= anchor (:heading/id %)) headings))
        (str "links to `" href "`, and " src " has no heading with the id `" anchor "`")))))

(defn site-problems
  "Returns the problems in the rendered `pages`, as `:problem/src`, `:problem/message`, and,
  for block markup, `:problem/line`."
  [pages]
  (let [pages-by-src (into {} (map (juxt :page/src identity)) pages)]
    (for [{:page/keys [src links markdown markdown-line] :as page} pages
          problem (concat (keep #(some->> (link-problem pages-by-src page %) (hash-map :problem/message)) links)
                          (blocks/block-problems markdown markdown-line))]
      (assoc problem :problem/src src))))

(defn problem-report
  "Returns `problem` as a line for the build output."
  [{:problem/keys [src line message]}]
  (str src (when line (str ":" line)) ": " message))
