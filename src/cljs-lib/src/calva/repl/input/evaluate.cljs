(ns calva.repl.input.evaluate
  "Evaluates from the REPL Inputs, their text or the part a command picks, in the context, and answers
   the evaluations' reads from stdin and interrupts them."
  (:require
   [calva.repl.input.context :as context]
   [calva.repl.input.evaluations :as evaluations]
   [calva.repl.input.host :as host]
   [calva.repl.input.recall :as recall]
   [calva.util :as util]
   [clojure.string :as string]))

(defonce ^{:doc "The NReplEvaluation and the stdin reply of each running evaluation, by evaluation id."}
  !running (atom {}))

(defn evaluation-message
  [id]
  {:command/name "repl-input-evaluation"
   :repl-input/evaluation (evaluations/bar (:repl-input/evaluations @host/!state) id)})

(defn- update-evaluations!
  [id f & args]
  (apply swap! host/!state update :repl-input/evaluations f id args)
  (host/post-to-view! id (evaluation-message id))
  (host/apply-focused-contexts!))

(defn- read-stdin+
  "Returns a promise of the line sent from the REPL Input `id` to the evaluation `evaluation-id`."
  [id evaluation-id]
  (js/Promise.
   (fn [resolve _]
     (swap! !running assoc-in [evaluation-id :send-line] resolve)
     (update-evaluations! id evaluations/reading-stdin evaluation-id true))))

(defn- evaluated!
  [{:keys [id evaluation-id evaluation-context code-namespace]} succeeded?]
  (swap! !running dissoc evaluation-id)
  (swap! host/!state update :repl-input.context/lock context/lock-after evaluation-context code-namespace succeeded?)
  (update-evaluations! id evaluations/finished evaluation-id)
  (host/refresh-context!))

(defn- next-evaluation-id!
  []
  (:repl-input/last-evaluation-id
   (swap! host/!state update :repl-input/last-evaluation-id evaluations/next-id (js/Date.now))))

(defn- evaluate+
  "Evaluates the `code` of `request` from the REPL Input `id` as the evaluation `evaluation-id` in
   `evaluation-context`, as starting at `line` and `column`, sending the code to the output unless
   `send-code?` is false. Returns a promise of when it is done."
  [id evaluation-id {:keys [code line column send-code?]} {:repl-input.context/keys [ns ns-form session-key] :as evaluation-context}]
  (let [^js adapter @host/!adapter
        evaluation {:id id
                    :evaluation-id evaluation-id
                    :evaluation-context evaluation-context
                    :code-namespace (js->clj (.nsFromText adapter code))}]
    (update-evaluations! id evaluations/started evaluation-id)
    (-> (.evaluate adapter #js {:code code
                                :ns ns
                                :nsForm ns-form
                                :sessionKey session-key
                                :filePath (str "calva-repl-input/" evaluation-id ".clj")
                                :line (or line 0)
                                :column (or column 0)
                                :sendCode (not (false? send-code?))
                                :stdin #(read-stdin+ id evaluation-id)
                                :onSent #(swap! !running assoc-in [evaluation-id :evaluation] %)})
        (.then (fn [^js outcome] (.-succeeded outcome))
               (constantly false))
        (.then #(evaluated! evaluation %)))))

(defn- show-message!
  [message]
  (some-> ^js @util/vscode .-window (.showInformationMessage message)))

(defn- not-connected+
  [evaluation-context]
  (js/Promise.resolve (show-message! (context/not-connected-message evaluation-context))))

(defn ^:export evaluate-focused!
  "Evaluates the focused REPL Input's text in the context, adds it to the history and clears the REPL
   Input, or says that no session answers to the context's session key. Returns a promise of when the
   evaluation is done."
  []
  (let [{:repl-input/keys [focused records]} @host/!state
        {:repl-input/keys [text version]} (get records focused)]
    (if (string/blank? text)
      (js/Promise.resolve nil)
      (let [evaluation-context (host/refresh-context!)]
        (if (:repl-input.context/connected? evaluation-context)
          (let [evaluation-id (next-evaluation-id!)]
            (host/take-edit! focused version host/empty-text)
            (recall/add! focused evaluation-id text evaluation-context)
            (evaluate+ focused evaluation-id {:code text} evaluation-context))
          (not-connected+ evaluation-context))))))

(defn- picked-evaluation
  "Returns `[request overrides]` for what a pick returned: the evaluation request, and the context it names."
  [^js picked]
  (let [{:keys [code line column ns nsForm sessionKey sendCode]} (js->clj picked :keywordize-keys true)]
    [{:code code :line line :column column :send-code? sendCode}
     {:repl-input.context/ns ns
      :repl-input.context/ns-form nsForm
      :repl-input.context/session-key sessionKey}]))

(defn- evaluate-picked+
  [id evaluation-context picked]
  (let [[request overrides] (picked-evaluation picked)
        picked-context (context/evaluation-context evaluation-context overrides (.sessionKeys ^js @host/!adapter))]
    (if (:repl-input.context/connected? picked-context)
      (evaluate+ id (next-evaluation-id!) request picked-context)
      (not-connected+ picked-context))))

(defn ^:export evaluate-from-focused!
  "Evaluates what `pick` takes from a document with the focused REPL Input's text and selections, in the
   context, and keeps the text. `pick` gets the document and the context as `{ns nsForm sessionKey}`, and
   returns, or promises, `{code line column}` with the `ns`, `nsForm`, `sessionKey` and `sendCode` it
   changes, or nothing. Returns a promise of when the evaluation is done."
  [pick]
  (let [{:repl-input/keys [focused records]} @host/!state]
    (if-let [record (get records focused)]
      (let [{:repl-input.context/keys [ns ns-form session-key] :as evaluation-context} (host/refresh-context!)]
        (-> (js/Promise.resolve (pick (host/document record) #js {:ns ns :nsForm ns-form :sessionKey session-key}))
            (.then #(when % (evaluate-picked+ focused evaluation-context %)))))
      (js/Promise.resolve nil))))

(defn ^:export send-line!
  "Sends the focused REPL Input's text as the line the evaluation waiting for stdin reads, and clears
   the REPL Input."
  []
  (let [{:repl-input/keys [focused records] :as state} @host/!state
        evaluation-id (evaluations/waiting-for-stdin (:repl-input/evaluations state) focused)
        {:repl-input/keys [text version]} (get records focused)]
    (when-let [send (get-in @!running [evaluation-id :send-line])]
      (swap! !running update evaluation-id dissoc :send-line)
      (update-evaluations! focused evaluations/reading-stdin evaluation-id false)
      (host/take-edit! focused version host/empty-text)
      (send (or text "")))))

(defn- interrupt-evaluation!
  "Interrupts the NReplEvaluation `evaluation`. One that has had no reply yet isn't running to
   NReplEvaluation, so its session interrupts it."
  [^js evaluation]
  (if (.-running evaluation)
    (.interrupt evaluation)
    (-> (.. evaluation -session (interrupt (.-id evaluation)))
        (.catch #(js/console.error "Failed interrupting the REPL Input evaluation:" %)))))

(defn interrupt!
  [id]
  (doseq [evaluation-id (keys (get-in @host/!state [:repl-input/evaluations id]))]
    (some-> (get-in @!running [evaluation-id :evaluation]) interrupt-evaluation!)))

(defn ^:export interrupt-focused!
  "Interrupts the evaluations running from the focused REPL Input."
  []
  (some-> (:repl-input/focused @host/!state) interrupt!))
