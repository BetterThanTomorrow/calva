#!/usr/bin/env bb

;; Note: The shell commands may need to be modified if you're using Windows.
;;       At the time of this writing, both people who push use Unix-based machines.

(ns publish
  (:require [clojure.string :as str]
            [cheshire.core :as json]
            [clojure.java.shell :as shell]))

(def changelog-filename "CHANGELOG.md")
(def unreleased-header-re #"\[Unreleased\]\s+")

(defn get-unreleased-changelog-text
  [changelog-text unreleased-header-re]
  (-> changelog-text
      (str/split unreleased-header-re)
      (nth 1)
      (str/split #"##")
      (nth 0)
      str/trim))

(defn new-changelog-text
  [changelog-text unreleased-header-re version]
  (println "Updating changelog")
  (let [utc-date (-> (java.time.Instant/now)
                     .toString
                     (clojure.string/split #"T")
                     (nth 0))
        new-header (format "## [%s] - %s" version utc-date)
        new-text (str/replace-first
                  changelog-text
                  unreleased-header-re
                  (format "[Unreleased]\n\n%s\n\n" new-header))]
    new-text))

(defn throw-if-error [{:keys [exit out err] :as result}]
  (if-not (= exit 0)
    (throw (Exception. (if (empty? out)
                         err
                         out)))
    result))

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

(defn git-status []
  (println "Checking git status")
  (let [result (throw-if-error (shell/sh "git" "status"))
        out (:out result)
        [_ branch] (re-find #"^On branch (\S+)\n" out)
        up-to-date (re-find #"Your branch is up to date" out)
        clean (re-find #"nothing to commit, working tree clean" out)]
    (cond-> #{}
      (not= "dev" branch) (conj :not-on-dev)
      (not up-to-date) (conj :not-up-to-date)
      (not clean) (conj :branch-not-clean))))

(defn publish [version]
  (tag version)
  (push)
  (println "Open to follow the progress of the release:")
  (println "  https://app.circleci.com/pipelines/github/BetterThanTomorrow/calva"))

(when (= *file* (System/getProperty "babashka.file"))
  (let [changelog-text (slurp changelog-filename)
        calva-version (-> (slurp "package.json")
                          json/parse-string
                          (get "version"))
        unreleased-changelog-text (get-unreleased-changelog-text
                                   changelog-text
                                   unreleased-header-re)
        status (git-status)]
    (when (or (seq status)
              (empty? unreleased-changelog-text))
      (when (seq status)
        (println "Git status issues: " status))
      (when (empty? unreleased-changelog-text)
        (println "There are no unreleased changes in the changelog."))
      (println "Release anyway? YES/NO: ")
      (flush)
      (let [answer (str (read))]
        (when-not (= "YES" answer)
          (println "Aborting publish.")
          (System/exit 0))))
    (if (empty? unreleased-changelog-text)
      (publish calva-version)
      (let [updated-changelog-text (new-changelog-text changelog-text
                                                       unreleased-header-re
                                                       calva-version)]
        (spit changelog-filename updated-changelog-text)
        (commit-changelog changelog-filename
                          (str "Add changelog section for v" calva-version " [skip ci]"
                               (when *command-line-args*
                                 (str "\n\n" (first *command-line-args*)))))
        (publish calva-version)))))
