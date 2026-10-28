(ns bundle-size
  "Checks that the release build of the Output views' webview bundle stays within a size limit, so that a
   dependency that makes every Output view load slower is a decision. Runs with bb, and with the Clojure
   CLI where bb isn't installed, as in CI."
  (:require [clojure.java.io :as io]))

(def default-bundle "repl-output-ui/js/main.js")

(def limit
  "The most bytes the webview bundle may have. The bundle was about 761 KB with CodeMirror for the REPL
   Input, which leaves room for small changes, but not for another library of CodeMirror's size."
  900000)

(defn within-limit?
  "Prints the size of `bundle` and returns true when it is within the limit."
  [bundle]
  (let [size (.length (io/file bundle))]
    (println (format "%s: %,d bytes, limit %,d bytes." bundle size limit))
    (or (<= size limit)
        (do (println "The Output views' webview bundle grew past its size limit."
                     "If the growth is wanted, raise `limit` in scripts/bundle_size.clj.")
            false))))

(defn report!
  "Checks the size of the release-built webview bundle, and exits with 1 when it is past the limit.
   A missing bundle means there is no release build to check."
  [{:keys [bundle] :or {bundle default-bundle}}]
  (when-not (.exists (io/file bundle))
    (println "No release build output at" bundle "- run `npm run release-cljs` first.")
    (System/exit 2))
  (when-not (within-limit? bundle)
    (System/exit 1)))
