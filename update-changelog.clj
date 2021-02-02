#!/usr/bin/env bb

(require '[clojure.string :as str])

;; TODO: Check if any list items under Unreleased header, and if not, throw exception

(let [changelog-filename "CHANGELOG.md"
      changelog-text (slurp changelog-filename)
      unreleased-header-re #"\[Unreleased\]"
      content-after-unreleased (-> changelog-text
                                   (str/split unreleased-header-re)
                                   (nth 1)
                                   (str/split #"##")
                                   (nth 0)
                                   str/trim)
      new-text (str/replace-first changelog-text unreleased-header-re "[Unreleased]\n\n## [MY NEW HEADER]")]
  (if (empty? content-after-unreleased)
    (throw (Exception. "There are no items to be released in the changelog. Update the changelog before releasing."))
    content-after-unreleased)
  #_(spit changelog-filename new-text))