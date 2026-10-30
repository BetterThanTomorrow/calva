(ns fiddles.output-views-checks
  "Checks that tell whether the Output views' styles and markup changed. Run from the `clj` session
   against the `:repl-output-ui` runtimes: each Output view page is one runtime."
  (:require [clojure.data :as data]
            [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.pprint :as pprint]
            [shadow.cljs.devtools.api :as shadow]))

(def baseline-dir
  "Where the baselines are kept, next to the plan they serve."
  (str (System/getProperty "user.home")
       "/Projects/calva-research/output-views-hiccup-and-styles/baselines"))

(defn runtime-ids
  "Returns the ids of the `:repl-output-ui` runtimes, one per Output view page."
  []
  (mapv :client-id (shadow/repl-runtimes :repl-output-ui)))

(defn webview-eval
  "Evaluates `form` in the Output view page `runtime-id`, and returns its value read back as data."
  [runtime-id form]
  (let [{:keys [results err]} (shadow/cljs-eval :repl-output-ui (pr-str form) {:runtime-id runtime-id})]
    (when (seq err)
      (throw (ex-info "The webview evaluation failed" {:err err :form form})))
    (some-> (last results) edn/read-string)))

(defn runtime-id
  "Returns the runtime id of the page of `view-kind`, `:output-view` or `:output-sidebar`."
  [view-kind]
  (some (fn [id]
          (when (= (name view-kind)
                   (webview-eval id '(some-> (js/document.querySelector "[data-repl-input-id]") .-dataset .-replInputId)))
            id))
        (runtime-ids)))

(def ^:private requires
  '(require '[calva.repl.webview.stacktrace :as stacktrace]
            '[calva.repl.webview.stacktrace-fixtures :as stacktrace-fixtures]
            '[calva.repl.webview.ui :as ui]
            '[clojure.string :as str]))

(def ^:private readers
  "The page side of the checks, defined in `cljs.user` of each page."
  '(do

     (defn ovc-attribute-value [attribute-name value]
       (cond
         (= "nonce" attribute-name) "<nonce>"
         (= "content" attribute-name) (str/replace value #"'nonce-[^']+'" "'nonce-<nonce>'")
         :else value))

     (defn ovc-node [node]
       (case (.-nodeType node)
         3 (let [text (.-textContent node)]
             (when-not (str/blank? text) text))
         1 (let [tag (keyword (str/lower-case (.-tagName node)))
                 attributes (into (sorted-map)
                                  (for [attribute (array-seq (.-attributes node))]
                                    [(.-name attribute) (ovc-attribute-value (.-name attribute) (.-value attribute))]))]
             (if (.contains (.-classList node) "cm-editor")
               [tag attributes :codemirror]
               (into [tag attributes] (keep ovc-node) (array-seq (.-childNodes node)))))
         nil))

     (defn ovc-dom []
       (pr-str (ovc-node js/document.documentElement)))

     (defn ovc-rules []
       (pr-str (some->> (array-seq js/document.styleSheets)
                        (filter #(some-> (.-ownerNode %) (.matches "link[href$='main.css'], style#calva-output-styles")))
                        first
                        .-cssRules
                        array-seq
                        (mapv #(.-cssText %)))))

     (defn ovc-post! [message]
       (ui/handle-message (js-obj "data" (pr-str message))))

     (def ovc-png "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")

     (defn ovc-fixture-messages []
       (let [clj {:meta/ns "user" :meta/repl-session-key "clj"}
             cljs {:meta/ns "cljs.user" :meta/repl-session-key "cljs" :meta/shadow-build ":app" :meta/shadow-runtime-id 1}]
         [{:command/name "show-evaluated-code" :output-category "evaluatedCode" :output "(map inc (range 3))" :meta clj}
          {:command/name "show-result" :output-category "evalResults" :output "(1 2 3)" :meta clj}
          {:command/name "show-stdout" :output-category "evalOut" :output "hello\nworld\n" :meta clj}
          {:command/name "show-stdout" :output-category "evalErr" :output "oops\n" :meta clj}
          {:command/name "show-stdout" :output-category "otherOut" :output "nREPL server started\n"}
          {:command/name "show-stdout" :output-category "otherErr" :output "WARNING: something\n"}
          {:command/name "show-result" :output-category "evalResults" :output (str "\"" ovc-png "\"") :meta clj}
          {:command/name "show-result" :output-category "evalResults" :output "{:a 1, :b [2 3], :c \"four\"}" :meta cljs}
          {:command/name "show-error" :id "ovc-runtime-error" :error/category "evalErr" :error/unfolded? true
           :error/text "Execution error (ExceptionInfo) at user/eval1 (REPL:1).\nboom"
           :error/causes (mapv stacktrace/cause-data stacktrace-fixtures/runtime-chain) :meta clj}
          {:command/name "show-error" :id "ovc-compile-error" :error/category "evalErr" :error/unfolded? false
           :error/text "Syntax error compiling at (REPL:1:1).\nUnable to resolve symbol: foo in this context"
           :error/causes (mapv stacktrace/cause-data stacktrace-fixtures/compile-unresolved) :meta clj}]))

     (defn ovc-post-fixture! []
       (ovc-post! {:command/name "clear-output-view"})
       (run! ovc-post! (ovc-fixture-messages))
       :posted)

     (defn ovc-image-display []
       (.. js/document -body -dataset -imageDisplay))

     (defn ovc-set-image-display! [display]
       (ovc-post! {:command/name "set-image-display" :image-display display})
       display)

     (defn ovc-time-append [n]
       (ovc-post! {:command/name "clear-output-view"})
       (let [started (js/performance.now)]
         (dotimes [i n]
           (ovc-post! {:command/name "show-stdout"
                       :output-category (if (even? i) "evalOut" "otherOut")
                       :output (str "line " i " (range 10) => (0 1 2 3 4 5 6 7 8 9)\n")}))
         (let [ms (js/Math.round (- (js/performance.now) started))]
           (ovc-post! {:command/name "clear-output-view"})
           ms)))
     :installed))

(defn install!
  "Defines the page side of the checks in the Output view page `runtime-id`."
  [runtime-id]
  (webview-eval runtime-id requires)
  (webview-eval runtime-id readers))

(defn- settle! [] (Thread/sleep 1500))

(defn snapshot
  "Posts the fixed output to the page `runtime-id`, and returns its styles and its DOM, in both image
   displays, as data. Clears the page's output, and leaves its image display as it was."
  [runtime-id]
  (install! runtime-id)
  (let [display (webview-eval runtime-id '(ovc-image-display))
        other (if (= "raw" display) "images" "raw")
        _ (webview-eval runtime-id '(ovc-post-fixture!))
        _ (settle!)
        rules (edn/read-string (webview-eval runtime-id '(ovc-rules)))
        dom (edn/read-string (webview-eval runtime-id '(ovc-dom)))
        _ (webview-eval runtime-id (list 'ovc-set-image-display! other))
        _ (settle!)
        other-dom (edn/read-string (webview-eval runtime-id '(ovc-dom)))]
    (webview-eval runtime-id (list 'ovc-set-image-display! display))
    {:image-display display
     :rules rules
     :dom {display dom other other-dom}}))

(defn time-append
  "Returns the milliseconds the page `runtime-id` takes to append `n` stdout blocks, best of `rounds`."
  [runtime-id n rounds]
  (install! runtime-id)
  (apply min (repeatedly rounds #(webview-eval runtime-id (list 'ovc-time-append n)))))

(defn- baseline-file [view-kind]
  (io/file baseline-dir (str (name view-kind) ".edn")))

(defn save-baseline!
  "Writes the snapshot of the page of `view-kind` as its baseline."
  [view-kind]
  (let [file (baseline-file view-kind)]
    (io/make-parents file)
    (spit file (with-out-str (pprint/pprint (snapshot (runtime-id view-kind)))))
    (str file)))

(defn baseline [view-kind]
  (edn/read-string (slurp (baseline-file view-kind))))

(defn differences
  "Returns what differs between the baseline of `view-kind` and its page now, as
   `[only-in-baseline only-now]` for the rules and for the DOM, or nil when nothing differs."
  [view-kind]
  (let [before (baseline view-kind)
        now (snapshot (runtime-id view-kind))
        rules (when (not= (:rules before) (:rules now))
                (vec (take 2 (data/diff (:rules before) (:rules now)))))
        dom (when (not= (:dom before) (:dom now))
              (vec (take 2 (data/diff (:dom before) (:dom now)))))]
    (when (or rules dom)
      (cond-> {}
        rules (assoc :rules rules)
        dom (assoc :dom dom)))))

(comment
  (runtime-ids)
  (runtime-id :output-sidebar)
  (= (snapshot (runtime-id :output-view)) (snapshot (runtime-id :output-view)))
  (save-baseline! :output-view)
  (save-baseline! :output-sidebar)
  (differences :output-view)
  (differences :output-sidebar)
  (time-append (runtime-id :output-view) 3000 3)
  :rcf)
