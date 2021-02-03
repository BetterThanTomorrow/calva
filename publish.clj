#!/usr/bin/env bb

(require '[clojure.string :as str]
         '[cheshire.core :as json]
         '[clojure.java.shell :as shell])

(def changelog-filename "CHANGELOG.md")

(def calva-version (-> (slurp "package.json")
                       json/parse-string
                       (get "version")))

;; TODO: Move getting of unreleased content out to separate function
(defn update-changelog [file-name version]
  (println "Updating changelog")
  (let [changelog-text (slurp file-name)
        unreleased-header-re #"\[Unreleased\]\s+"
        unreleased-content (-> changelog-text
                               (str/split unreleased-header-re)
                               (nth 1)
                               (str/split #"##")
                               (nth 0)
                               str/trim)]
    (when-not (empty? unreleased-content)
      (let [utc-date (-> (java.time.Instant/now)
                         .toString
                         (clojure.string/split #"T")
                         (nth 0))
            new-header (format "## [%s] - %s" version utc-date)
            new-text (str/replace-first
                      changelog-text
                      unreleased-header-re
                      (format "[Unreleased]\n\n%s\n" new-header))]
        (spit changelog-filename new-text)))))

(defn commit-changelog [file-name message]
  (println "Committing")
  (shell/sh "git" "add" file-name)
  (shell/sh "git" "commit" "-m" message))

(defn tag [version]
  (println "Tagging")
  (shell/sh "git" "tag"
            "-a" (str "v" version)
            "-m" (str "Version " version)))

(update-changelog changelog-filename calva-version)
(commit-changelog changelog-filename "Test commit from publish script")
(tag calva-version)
