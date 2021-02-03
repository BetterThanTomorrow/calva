#!/usr/bin/env bb

(require '[clojure.string :as str]
         '[cheshire.core :as json])

(let [changelog-filename "CHANGELOG.md"
      changelog-text (slurp changelog-filename)
      unreleased-header-re #"\[Unreleased\]"
      unreleased-content (-> changelog-text
                             (str/split unreleased-header-re)
                             (nth 1)
                             (str/split #"##")
                             (nth 0)
                             str/trim)]
  (when-not (empty? unreleased-content)
    (let [version (-> (slurp "package.json")
                      json/parse-string
                      (get "version"))
          utc-date (-> (java.time.Instant/now)
                       .toString
                       (clojure.string/split #"T")
                       (nth 0))
          new-header (format "## [%s] - %s" version utc-date)
          new-text (str/replace-first
                    changelog-text
                    unreleased-header-re
                    (format "[Unreleased]\n\n%s" new-header))]
      (spit changelog-filename new-text))))