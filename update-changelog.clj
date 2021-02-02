#!/usr/bin/env bb

(require '[clojure.string :as str])

;; TODO: Check if any list items under Unreleased header, and if not, throw exception

(let [changelog-filename "CHANGELOG.md"
      changelog-text (slurp changelog-filename)
      unreleased-header-re #"\[Unreleased\]"
      new-text (str/replace-first changelog-text unreleased-header-re "[Unreleased]\n\n## [MY NEW HEADER]")]
  (spit changelog-filename new-text))