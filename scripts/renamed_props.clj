(ns renamed-props
  "Finds JavaScript property and method names that ClojureScript code reads, but that a release build's
   advanced compilation renamed, as it does for a property read on a value it can't tell is a JS object.
   Such a read works in development builds and gives `undefined` in release builds. Runs with bb, and with
   the Clojure CLI where bb isn't installed, as in CI."
  (:require [clojure.java.io :as io]
            [clojure.string :as string]))

(def default-outputs
  "The files `npm run release-cljs` writes for the extension and for the Output views' webview."
  ["out/cljs-lib/cljs-lib.js" "repl-output-ui/js/main.js"])

(def default-sources "src/cljs-lib/src")

(def ^:private munged-chars
  {\- "_" \! "_BANG_" \? "_QMARK_" \* "_STAR_" \> "_GT_" \< "_LT_" \= "_EQ_"})

(defn- munge-name
  [s]
  (apply str (map #(get munged-chars % %) s)))

(def ^:private name-re "([A-Za-z_$][\\w$!?*<>=-]*)")

(defn read-names
  "Returns the property and method names that `code`, one line of ClojureScript, reads with `.-name`,
   `(.name` and `(.. x -name (name))`, munged as the compiler munges them."
  [code]
  (let [code (-> code
                 (string/replace #"\"(?:[^\"\\\\]|\\\\.)*\"" "\"\"")
                 (string/split #";" 2)
                 first)
        dot-dots (map second (re-seq #"\(\.\.([^()]*)" code))]
    (map munge-name
         (concat (map second (re-seq (re-pattern (str "\\.-" name-re)) code))
                 (map second (re-seq (re-pattern (str "\\(\\." name-re)) code))
                 (mapcat #(map second (re-seq (re-pattern (str "\\s-" name-re)) %)) dot-dots)))))

(defn output-names
  "Returns the names in `js` that follow a `.` or a quote, which is how a kept property name appears in
   compiled output."
  [js]
  (set (map second (re-seq #"[.'\"]([A-Za-z_$][\w$]*)" js))))

(defn renamed-reads
  "Returns `{:file :line :name}` for each name that the `.cljs` and `.cljc` files under `sources` read and
   that none of the `outputs` has."
  [{:keys [outputs sources]}]
  (let [kept (into #{} (mapcat (comp output-names slurp)) outputs)]
    (for [file (->> (file-seq (io/file sources))
                    (filter #(re-find #"\.clj[sc]$" (.getName ^java.io.File %)))
                    (map str)
                    sort)
          [line-number line] (map-indexed (fn [i line] [(inc i) line]) (string/split-lines (slurp file)))
          name (distinct (read-names line))
          :when (not (kept name))]
      {:file file :line line-number :name name})))

(defn report!
  "Prints the renamed reads, and exits with 1 when there are any. Missing outputs mean there is no release
   build to scan."
  [{:keys [outputs] :or {outputs default-outputs} :as opts}]
  (let [missing (remove #(.exists (io/file %)) outputs)]
    (when (seq missing)
      (println "No release build output at" (string/join ", " missing) "- run `npm run release-cljs` first.")
      (System/exit 2))
    (let [reads (renamed-reads (merge {:sources default-sources} opts {:outputs outputs}))]
      (doseq [{:keys [file line name]} reads]
        (println (str file ":" line ": " name)))
      (println (count reads) "property reads renamed by the release build.")
      (when (seq reads)
        (System/exit 1)))))
