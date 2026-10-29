(ns release-check
  "Checks cljs-lib the way CI does: builds the tests and the Output views' webview with advanced
   compilation into a temp folder, runs the tests, checks the webview bundle's size, and scans pseudo-names
   release builds for JS property reads that the compilation renamed. The watchers' output folders are left
   alone."
  (:require [babashka.fs :as fs]
            [babashka.process :as p]
            [bundle-size]
            [renamed-props]))

(defn- release!
  "Release-builds `build` with `config` merged into its build config. Returns true when it built."
  [build config]
  (println "Release building" build)
  (zero? (:exit (p/shell {:continue true} "npx" "shadow-cljs" "-A:ci:test" "release" (str build)
                         "--config-merge" (pr-str config)))))

(defn- run-tests!
  "Runs the release-built tests at `tests-js` with node. Returns true when they pass."
  [tests-js]
  (println "Running the release-built cljs-lib tests")
  (zero? (:exit (p/shell {:continue true
                          :extra-env {"NODE_PATH" (str (fs/absolutize "node_modules"))}}
                         "node" tests-js))))

(defn check!
  "Runs the release check and exits with 1 when the tests fail, the webview bundle is past its size limit,
   or a release build renamed a property read."
  [_]
  (let [dir (str (fs/create-temp-dir {:prefix "calva-release-check"}))
        tests-js (str dir "/test/cljs-lib-tests.js")
        ui-dir (str dir "/ui")
        built? (every? true? [(release! :test {:output-to tests-js :autorun false})
                              (release! :repl-output-ui {:output-dir ui-dir})])]
    (when-not built?
      (println "A release build failed.")
      (System/exit 1))
    (let [tests-passed? (run-tests! tests-js)
          size-ok? (bundle-size/within-limit? (str ui-dir "/main.js"))
          renamed-ok? (renamed-props/check! {})]
      (fs/delete-tree dir)
      (when-not (and tests-passed? size-ok? renamed-ok?)
        (System/exit 1)))))
