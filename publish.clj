#!/usr/bin/env bb

;; Note: The shell commands may need to be modified if you're using Windows.
;;       At the time of this writing, both people who push use Unix-based machines.

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

(defn publish []
  (tag calva-version)
  (push)
  (println "Open to follow the progress of the release:")
  (println "  https://app.circleci.com/pipelines/github/BetterThanTomorrow/calva"))

(let [unreleased-changelog-text (get-unreleased-changelog-text
                                 changelog-text
                                 unreleased-header-re)]
  (if (empty? unreleased-changelog-text)
    (do
      (print "There are no unreleased changes in the changelog. Release anyway? y/n: ")
      (flush)
      (let [answer (read)]
        (if (= (str answer) "y")
          (publish)
          (println "Aborting publish."))))
    (do
      (update-changelog changelog-filename
                        changelog-text
                        unreleased-header-re
                        calva-version)
      (commit-changelog changelog-filename
                        (str "Add changelog section for v" calva-version " [skip ci]"))
      (publish))))