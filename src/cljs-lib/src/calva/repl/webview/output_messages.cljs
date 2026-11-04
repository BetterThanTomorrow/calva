(ns calva.repl.webview.output-messages
  "The messages the extension posts the Output views with output, errors and the colors of printed code."
  (:require
   [calva.pprint.printer :as printer]
   [calva.repl.input.highlighting :as highlighting]
   [calva.repl.webview.folding :as folding]
   [calva.repl.webview.printed-brackets :as printed-brackets]
   [calva.repl.webview.stacktrace :as stacktrace]
   [calva.util :as util]))

(defn- printed-colors
  "Returns `[ranges brackets]` for printed `text`: the grammar's ranges, nil before the grammar is loaded, and
   the brackets when it has ranges."
  [text settings]
  (let [ranges (highlighting/printed-highlighting text)]
    [ranges (when (seq ranges) (printed-brackets/brackets text settings))]))

(defn code-highlighting-message
  "Returns the message that posts the colors of the printed code `codes`, `[id text]` each, as
   `[id ranges brackets]`, the ranges nil before the grammar is loaded."
  [codes]
  (let [settings (printed-brackets/settings)]
    {:command/name "output-highlighting"
     :output/codes (mapv (fn [[id text]] (into [id] (printed-colors text settings))) codes)}))

(def ^:private highlighting-chunk-length
  "How many characters of printed code the extension highlights before it lets other work run."
  20000)

(defn code-chunks
  "Returns `codes`, `[id text]` each, in chunks of about `highlighting-chunk-length` characters."
  [codes]
  (->> codes
       (reduce (fn [chunks [_ text :as code]]
                 (let [{:keys [length]} (peek chunks)]
                   (if (and length (< length highlighting-chunk-length))
                     (conj (pop chunks) (-> (peek chunks)
                                            (update :codes conj code)
                                            (update :length + (count text))))
                     (conj chunks {:codes [code] :length (count text)}))))
               [])
       (map :codes)))

(def output-category->command-name
  {"otherOut" "show-stdout"
   "evalOut" "show-stdout"
   "evalResults" "show-result"
   "evaluatedCode" "show-evaluated-code"
   "evalErr" "show-stdout"
   "otherErr" "show-stdout"
   "clojure" "show-result"})

(def ^:private meta-sources
  "Each meta key, with the keys of an options map that give it, and the properties of an options JS object,
   the first one set wins."
  {:meta/who [[:meta/who :who]
              ["who"]]
   :meta/ns [[:meta/ns :ns]
             ["ns"]]
   :meta/repl-session-key [[:meta/repl-session-key :meta/repl-session-type :replSessionKey :replSessionType
                            :repl-session-key :repl-session-type]
                           ["replSessionKey" "replSessionType"]]
   :meta/shadow-build [[:meta/shadow-build :shadowBuild :shadow-build]
                       ["shadowBuild"]]
   :meta/shadow-runtime-id [[:meta/shadow-runtime-id :shadowRuntimeId :shadow-runtime-id]
                            ["shadowRuntimeId"]]
   :meta/evaluation-id [[:evaluationId]
                        ["evaluationId"]]})

(defn- option
  "Returns the first of the `map-keys` set in `options` when it is a map, otherwise the first of the
   `properties` set in the JS object."
  [^js options [map-keys properties]]
  (if (map? options)
    (some #(get options %) map-keys)
    (some #(unchecked-get options %) properties)))

(defn options->meta
  "Returns the meta data of the output `options`, a map or a JS object, or nil without options."
  [^js options]
  (when options
    (into {}
          (keep (fn [[k sources]]
                  (some->> (option options sources) (vector k))))
          meta-sources)))

(def ^:private printed-code-commands #{"show-result" "show-evaluated-code"})

(defn- fold-results-longer-than
  "The setting `calva.outputViews.foldResultsLongerThan`, 5000 without one."
  []
  (let [setting (some-> ^js @util/vscode .-workspace (.getConfiguration "calva") (.get "outputViews.foldResultsLongerThan"))]
    (if (and (number? setting) (js/isFinite setting)) setting 5000)))

(defn output-message
  "Returns the message that shows `message` with `command-name`, for output of `output-category` with `options`,
   and printed code's highlighting. An evaluation result to be shown folded is marked `:output/folded?`, and
   has no highlighting."
  [options command-name output-category message]
  (let [meta-data (options->meta options)
        folded? (and (= "show-result" command-name)
                     (= "evalResults" output-category)
                     (folding/folded? message (fold-results-longer-than)))
        [code-highlighting code-brackets] (when (and (printed-code-commands command-name)
                                                     (string? message)
                                                     (not folded?))
                                            (printed-colors message (printed-brackets/settings)))]
    (cond-> {:command/name command-name
             :output-category output-category
             :output message}
      (seq meta-data) (assoc :meta meta-data)
      folded? (assoc :output/folded? true)
      code-highlighting (assoc :output/highlighting code-highlighting)
      code-brackets (assoc :output/brackets code-brackets))))

(defn- pretty-printing-width
  "The width `calva.prettyPrintingOptions` prints to, 120 without one."
  []
  (or (some-> ^js @util/vscode .-workspace (.getConfiguration "calva") (.get "prettyPrintingOptions") .-width)
      120))

(def ^:private max-pretty-data-length
  "The longest ex-data that is pretty-printed. zprint takes the extension host about 10 ms per 1,000
   characters, and longer data shows as printed."
  10000)

(defn- with-pretty-data
  "Returns `cause` with its ex-data pretty-printed `width` wide, its maps in the order they were printed,
   when it is no longer than `max-pretty-data-length`."
  [width {:keys [data] :as cause}]
  (cond-> cause
    (and data (<= (count data) max-pretty-data-length))
    (assoc :data (:value (printer/pretty-print data {:width width :map {:sort? false}})))))

(defonce ^{:private true :doc "The causes of the last error, and their data, which each Output view asks for."}
  !last-causes (atom nil))

(defn- causes-data
  [^js causes]
  (let [{last-causes :causes :keys [data]} @!last-causes]
    (if (identical? causes last-causes)
      data
      (let [width (pretty-printing-width)
            data (mapv (comp #(with-pretty-data width %) stacktrace/cause-data) (js->clj causes :keywordize-keys true))]
        (reset! !last-causes {:causes causes :data data})
        data))))

(defn error-message
  "Returns the message that shows the error `text` and its `causes`, a JS array of cider-nrepl cause
   messages or nil when they come later, as the Output view entry `error-id`. `options` are those
   of `append`, plus `unfolded`."
  [^js options text ^js causes error-id]
  (let [category (if (map? options) (:outputCategory options) (.-outputCategory options))
        unfolded? (if (map? options) (:unfolded options) (.-unfolded options))
        meta-data (options->meta options)]
    (cond-> {:command/name "show-error"
             :error/text text
             :error/category category
             :error/causes (causes-data causes)
             :error/unfolded? (boolean unfolded?)}
      error-id (assoc :id error-id)
      (seq meta-data) (assoc :meta meta-data))))

(defn causes-message
  "Returns the message that gives the Output view entry `error-id` its `causes`."
  [error-id ^js causes]
  {:command/name "show-error-causes"
   :error/id error-id
   :error/causes (causes-data causes)})

(defn evaluation-ended-message
  [evaluation-id]
  {:command/name "evaluation-ended"
   :meta/evaluation-id evaluation-id})
