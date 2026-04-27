(ns tasks
  (:require [clojure.string :as string]
            util))

(defn package-dev-release! [{:keys [slug dry]}]
  (let [current-version (-> (util/sh false "node" "-p" "require('./package').version")
                            :out string/trim)
        slug (or slug (-> (util/sh false "git" "rev-parse" "--abbrev-ref" "HEAD")
                          :out string/trim))
        commit-id (-> (util/sh false "git" "rev-parse" "--short" "HEAD")
                      :out string/trim)
        random-slug (util/random-slug 2)
        slugged-branch (string/replace slug #"/" "-")
        version (str current-version "-" slugged-branch "-" commit-id "-" random-slug)
        package-name "calva"
        vsix-file (str package-name "-" version ".vsix")]
    (println "Current version:" current-version)
    (println "HEAD Commit ID:" commit-id)
    (println "Packaging pre-release...")
    (util/shell dry "npm" "version" "--no-git-tag-version" version)
    (try
      (util/shell dry "npx" "vsce" "package" "--pre-release" "--no-dependencies")
      (finally
        (util/shell dry "npm" "version" "--no-git-tag-version" current-version)))
    (println "Created:" vsix-file)))
