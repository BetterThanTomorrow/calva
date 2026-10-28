(ns renamed-props
  "Finds JavaScript property and method names that ClojureScript code reads, but that a release build's
   advanced compilation renamed, as it does for a property read on a value it can't tell is a JS object.
   Such a read works in development builds and gives `undefined` in release builds. Release-builds each
   bundle that ships with pseudo names, where a renamed property shows as `.$name$`, and checks that
   bundle against the names read by the sources its source map lists. Runs with bb, and with the Clojure
   CLI where bb isn't installed, as in CI."
  (:require [clojure.java.io :as io]
            [clojure.string :as string]
            [rewrite-clj.node :as node]
            [rewrite-clj.parser :as parser]))

(def bundles
  "The release builds that ship, with where the pseudo-names build writes each one in its folder."
  [{:build :calva-lib :output "cljs-lib.js"}
   {:build :repl-output-ui :output "ui/main.js"}])

(def default-sources "src/cljs-lib/src")

(defn- release-config
  [dir]
  {:output-to (str dir "/cljs-lib.js")
   :output-dir (str dir "/ui")
   :compiler-options {:pseudo-names true :source-map true}})

(defn release!
  "Release-builds the `bundles` into `dir` with pseudo names and source maps. Returns true when they built."
  [dir]
  (println "Release building" (string/join " " (map :build bundles)) "with pseudo names")
  (let [command (concat ["npx" "shadow-cljs" "-A:ci:test" "release"]
                        (map (comp str :build) bundles)
                        ["--config-merge" (pr-str (release-config dir))])]
    (zero? (.waitFor (.start (.inheritIO (ProcessBuilder. ^java.util.List (vec command))))))))

(def ^:private munged-chars
  {\- "_" \! "_BANG_" \? "_QMARK_" \* "_STAR_" \> "_GT_" \< "_LT_" \= "_EQ_"})

(defn- munge-name
  [s]
  (apply str (map #(get munged-chars % %) s)))

(def ^:private name-pattern "[A-Za-z_$][\\w$!?*<>=-]*")

(defn- forms
  [n]
  (when (node/inner? n)
    (remove #(or (node/whitespace-or-comment? %) (= :uneval (node/tag %))) (node/children n))))

(defn- token-string
  [n]
  (when (= :token (node/tag n))
    (node/string n)))

(defn- token-names
  "Returns the names that the symbol `s` reads: `name` in `.-name` and `.name`, and the properties in
   `js/global.name`."
  [s]
  (if-let [[_ property] (re-matches (re-pattern (str "\\.-?(" name-pattern ")")) s)]
    [property]
    (some-> (re-matches #"js/[^.]+\.(.+)" s) second (string/split #"\."))))

(defn- member-name
  "Returns the name of the member `n` in a `(. x member)` or `(.. x member ...)` form, written `-name`,
   `name` or `(name args)`."
  [n]
  (some->> (if (= :list (node/tag n)) (some-> (first (forms n)) token-string) (token-string n))
           (re-matches (re-pattern (str "-?(" name-pattern ")")))
           second))

(defn- node-reads
  [n]
  (let [children (forms n)
        members (case (some-> (first children) token-string)
                  ".." (drop 2 children)
                  "." (take 1 (drop 2 children))
                  nil)
        line (comp :row meta)]
    (concat (keep #(some->> (member-name %) (vector (line %))) members)
            (map #(vector (line n) %) (some-> (token-string n) token-names))
            (mapcat node-reads children))))

(defn read-names
  "Returns `[line name]` for each property and method name that `code`, ClojureScript source, reads with
   `.-name`, `.name`, `(. x name)`, `(.. x -name name (name))` and `js/global.name`, munged as the
   compiler munges them."
  [code]
  (distinct (map (fn [[line property]] [line (munge-name property)])
                 (node-reads (parser/parse-string-all code)))))

(defn renamed-names
  "Returns the property names that `js`, pseudo-names compiled output, shows renamed as `.$name$`."
  [js]
  (set (map second (re-seq #"\.\$([A-Za-z_]\w*)\$(?![\w$])" js))))

(defn source-map-sources
  "Returns the source paths that the source map `map-json` lists."
  [map-json]
  (set (for [[_ sources] (re-seq #"\"sources\":\[([^\]]*)\]" map-json)
             [_ path] (re-seq #"\"((?:[^\"\\]|\\.)*)\"" sources)]
         (string/replace path "\\/" "/"))))

(defn renamed-reads
  "Returns `{:build :file :line :name}` for each name that a source in a bundle in `dir` reads and that the
   bundle has renamed. A bundle's sources are the `.cljs` and `.cljc` files under `sources` that its source
   map lists."
  [{:keys [dir sources]}]
  (for [{:keys [build output]} bundles
        :let [js-file (str dir "/" output)
              renamed (renamed-names (slurp js-file))
              in-bundle (source-map-sources (slurp (str js-file ".map")))]
        path (sort in-bundle)
        :let [file (io/file sources path)]
        :when (and (re-find #"\.clj[sc]$" path) (.exists file))
        [line property] (read-names (slurp file))
        :when (renamed property)]
    {:build build :file (str file) :line line :name property}))

(defn- delete-tree!
  [dir]
  (run! io/delete-file (reverse (file-seq (io/file dir)))))

(defn check!
  "Release-builds the bundles with pseudo names into a temp folder and prints the renamed reads. Returns
   true when the bundles built and no read was renamed."
  [{:keys [sources] :or {sources default-sources}}]
  (let [dir (str (java.nio.file.Files/createTempDirectory "calva-renamed-props"
                                                          (make-array java.nio.file.attribute.FileAttribute 0)))]
    (try
      (if (release! dir)
        (let [reads (renamed-reads {:dir dir :sources sources})]
          (doseq [{:keys [build file line name]} reads]
            (println (str file ":" line ": " name " (" build ")")))
          (println (count reads) "property reads renamed by the release build.")
          (empty? reads))
        (do (println "A pseudo-names release build failed.")
            false))
      (finally
        (delete-tree! dir)))))

(defn report!
  "Runs `check!` and exits with 1 when it fails."
  [opts]
  (when-not (check! opts)
    (System/exit 1)))
