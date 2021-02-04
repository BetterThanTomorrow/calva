#!/usr/bin/env bb

;; Note: The shell commands may need to be modifying if you're using Windows.
;;       At the time of this writing, both people who push use Unix-based machines.

;; Steps to reverse the effects of this script
;; 
;;  1. git reset HEAD^
;;  2. git tag -d <tag-name> ;; Where tag-name is like v2.0.159
;;  3. git push --delete origin <tag-name>
;;  4. git checkout -- CHANGELOG.md

(require '[clojure.string :as str]
         '[cheshire.core :as json]
         '[clojure.java.shell :as shell])

(def changelog-filename "CHANGELOG.md")
(def changelog-text (slurp changelog-filename))
(def unreleased-header-re #"\[Unreleased\]\s+")
(def calva-version (-> (slurp "package.json")
                       json/parse-string
                       (get "version")))

(defn get-unreleased-changelog-text
  [changelog-text unreleased-header-re]
  (-> changelog-text
      (str/split unreleased-header-re)
      (nth 1)
      (str/split #"##")
      (nth 0)
      str/trim))

(defn update-changelog
  [file-name changelog-text unreleased-header-re version]
  (println "Updating changelog")
  (let [utc-date (-> (java.time.Instant/now)
                     .toString
                     (clojure.string/split #"T")
                     (nth 0))
        new-header (format "## [%s] - %s" version utc-date)
        new-text (str/replace-first
                  changelog-text
                  unreleased-header-re
                  (format "[Unreleased]\n\n%s\n" new-header))]
    (spit file-name new-text)))

(defn throw-if-error [{:keys [exit out err]}]
  (when-not (= exit 0)
    (throw (Exception. (if (empty? out)
                         err
                         out)))))

(defn commit-changelog [file-name message]
  (println "Committing")
  (shell/sh "git" "add" file-name)
  (throw-if-error (shell/sh "git" "commit" 
                            "-m" message
                            "-o" file-name)))

(defn tag [version]
  (println "Tagging with version" version)
  (throw-if-error (shell/sh "git" "tag"
                            "-a" (str "v" version)
                            "-m" (str "Version " version))))

(defn push []
  (println "Pushing")
  (throw-if-error (shell/sh "git" "push" "--follow-tags")))

(defn open-ci-in-browser []
  (shell/sh "xdg-open" "https://app.circleci.com/pipelines/github/BetterThanTomorrow/calva")
  nil)

(let [unreleased-changelog-text (get-unreleased-changelog-text
                                 changelog-text
                                 unreleased-header-re)]
  (if (empty? unreleased-changelog-text)
    (println "Aborting publish. There are no unreleased changes in the changelog.")
    (do
      (update-changelog changelog-filename 
                        changelog-text
                        unreleased-header-re
                        calva-version)
      (commit-changelog changelog-filename
                        (str "Add changelog section for v" calva-version))
      (tag calva-version)
      (push)
      (open-ci-in-browser))))
