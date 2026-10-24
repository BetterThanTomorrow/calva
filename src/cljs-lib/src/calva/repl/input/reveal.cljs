(ns calva.repl.input.reveal
  "Goes to definitions from the REPL Inputs, and from files to definitions that REPL Input evaluations
   made: keeps the code of the latest evaluations, reveals an evaluation's code block in an Output view,
   or opens its read-only entry."
  (:require
   [calva.repl.input.completion :as completion]
   [calva.repl.input.config :as config]
   [calva.repl.input.definition :as definition]
   [calva.repl.input.host :as host]
   [calva.util :as util]))

(defonce ^{:doc "The Output views by view id, each with `:view`, which returns its webview view while it shows
                 output, and `:show!`, which reveals it, keeping the focus where it is when given true."}
  !output-views (atom {}))

(defonce ^:private !last-request (atom 0))

(def ^:private answer-timeout-ms 500)

(defn set-output-views!
  [output-views]
  (reset! !output-views output-views))

(defn load-evaluated-code!
  []
  (swap! host/!state assoc :repl-input/evaluated-code (definition/from-stored (config/evaluated-code))))

(defn keep-code!
  "Keeps `code`, evaluated as the evaluation `id` from the zero-based `line` and `column` of a REPL Input,
   with the code of the latest evaluations."
  [id code line column]
  (let [{:repl-input/keys [evaluated-code]}
        (swap! host/!state update :repl-input/evaluated-code definition/add-evaluation (definition/evaluation id code line column))]
    (config/store-evaluated-code! (definition/stored evaluated-code))))

(defn- answered-found?
  "Returns whether `msg`, posted by an Output view, says that it has the block of `request`, or nil when
   `msg` answers something else."
  [request ^js msg]
  (let [{:keys [command found?] answered :request} (js->clj msg :keywordize-keys true)]
    (when (and (= "repl-input-evaluation-revealed" command) (= request answered))
      (boolean found?))))

(defn- ask-view+
  "Posts `message` to the webview view `view`, and returns a promise of whether the view has the block it
   asks for, or of false when the view doesn't answer in time."
  [^js view {:keys [request] :as message}]
  (js/Promise.
   (fn [resolve _]
     (let [!listener (atom nil)
           answer! (fn [found?]
                     (some-> ^js @!listener .dispose)
                     (resolve found?))]
       (reset! !listener (.. view -webview (onDidReceiveMessage #(some-> (answered-found? request %) answer!))))
       (js/setTimeout #(answer! false) answer-timeout-ms)
       (.. view -webview (postMessage (pr-str message)))))))

(defn- showing-views
  []
  (keep (fn [[view-id {:keys [view]}]]
          (when-let [^js webview-view (view)]
            {:view-id view-id :view webview-view :visible? (.-visible webview-view)}))
        @!output-views))

(defn ^:export reveal-evaluation+
  "Reveals the code block of the evaluation `id` in an Output view that has it, with the definition at
   `line` and `column`, as the REPL reports them, marked. Returns a promise of whether a view has it."
  [id line column]
  (let [message {:command/name "repl-input-reveal-evaluation"
                 :request (swap! !last-request inc)
                 :repl-input.evaluation/id id
                 :line line
                 :column column}
        views (showing-views)]
    (-> (js/Promise.all (into-array (map #(ask-view+ (:view %) message) views)))
        (.then (fn [found]
                 (when-let [view-id (definition/revealing-view (map #(assoc %1 :found? %2) views found))]
                   ((get-in @!output-views [view-id :show!]) true)
                   true)))
        (.then boolean))))

(defn- entry-location
  [id line column]
  (definition/entry-location (:repl-input/evaluated-code @host/!state) id {:line line :column column}))

(defn ^:export evaluation-location
  "Returns where the definition at `line` and `column`, as the REPL reports them, is in the read-only
   entry of the evaluation `id`, as `{uri line character}`, or nil."
  [id line column]
  (clj->js (entry-location id line column)))

(defn ^:export evaluation-code
  "Returns the code of the evaluation that `path`, the path of a read-only entry's uri, names."
  [path]
  (or (definition/entry-code (:repl-input/evaluated-code @host/!state) path) ""))

(defn- target+
  "Returns a promise of what `f` promises, or of nil when it fails."
  [f]
  (-> (js/Promise. (fn [resolve _] (resolve (f))))
      (.catch (fn [err]
                (js/console.error "Failed finding the definition for the REPL Input:" err)
                nil))))

(defn- repl-target+
  [{:repl-input.context/keys [ns session-key connected?]} doc offset]
  (if connected?
    (.then (target+ #(.replDefinition ^js @host/!adapter session-key ns doc offset))
           #(some-> % (js->clj :keywordize-keys true) definition/repl-target))
    (js/Promise.resolve nil)))

(defn- lsp-target+
  "Asks clojure-lsp for the definition at `offset` in `text`, in a copy below the followed `document` or the
   `ns` form of `context`."
  [{:repl-input.context/keys [locked?] :as context} ^js document text offset]
  (let [{copy-text :text :keys [line character text-line]} (completion/copy context (some-> document .getText) text offset)
        copy {:text-line text-line
              :document-uri (when (and document (not locked?)) (str (.-uri document)))}]
    (.then (target+ #(.lspDefinition ^js @host/!adapter (some-> document .-uri) copy-text line character))
           #(definition/lsp-target copy (some-> % (js->clj :keywordize-keys true))))))

(defn- first-target+
  "Returns a promise of the first target that the `providers`, in order, find with `target-fns`."
  [providers target-fns]
  (reduce (fn [found+ provider]
            (.then found+ #(or % (some-> (get target-fns provider) (apply [])))))
          (js/Promise.resolve nil)
          providers))

(defn- no-definition!
  []
  (.. ^js @util/vscode -window (setStatusBarMessage "No definition found" 3000)))

(defn- open-entry!
  [id line column]
  (if-let [{:keys [uri line character]} (entry-location id line column)]
    (.openLocation ^js @host/!adapter uri line character)
    (no-definition!)))

(defn- go-to+
  [{:keys [target id line column definition uri character]}]
  (let [^js adapter @host/!adapter]
    (case target
      :evaluation (.then (reveal-evaluation+ id line column)
                         #(when-not % (open-entry! id line column)))
      :repl-file (.openReplDefinition adapter (clj->js definition))
      :location (.openLocation adapter uri line character)
      (no-definition!))))

(defn reveal-definition!
  "Goes to the definition at `offset` in `text` of a REPL Input, asking the providers in the order of
   `calva.definitionProviderPriority`. Returns a promise of when that is done."
  [{:keys [text offset]}]
  (let [context (host/refresh-context!)
        doc (host/document {:repl-input/text text :repl-input/selections [[offset offset]]})
        document (get-in @host/!state [:repl-input.context/editor :document])
        ^js adapter @host/!adapter]
    (-> (first-target+ (.definitionPriority adapter)
                       {"repl" #(repl-target+ context doc offset)
                        "lsp" #(lsp-target+ context document text offset)})
        (.then go-to+))))

(defn ^:export reveal-definition-focused!
  "Goes to the definition at the cursor of the focused REPL Input. Returns a promise of when that is done."
  []
  (let [{:repl-input/keys [focused records]} @host/!state
        {:repl-input/keys [text selections]} (get records focused)]
    (if focused
      (reveal-definition! {:text (or text "") :offset (second (first selections))})
      (js/Promise.resolve nil))))
