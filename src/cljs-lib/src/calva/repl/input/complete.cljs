(ns calva.repl.input.complete
  "Completes in the REPL Inputs from the REPL, resolves a candidate's docs, and sets the context keys while
   a REPL Input's completion list is open."
  (:require
   [calva.repl.input.completion :as completion]
   [calva.repl.input.host :as host]))

(defonce ^{:doc "The request in flight, as `[id request]`, and the items each REPL Input was last answered
                 with, with what resolving them needs."}
  !completions (atom {}))

(defn- in-flight?
  [id request]
  (= [id request] (get-in @!completions [:in-flight :request])))

(defn- answer!
  "Posts the `items` to the REPL Input as its answer to the `request`, and keeps them, with the `answer`'s
   context and file, for resolving."
  [{:keys [request] :repl-input/keys [id] :as answer} ^js items final?]
  (swap! !completions assoc-in [:answers id] (assoc answer :items items))
  (host/post-to-view! id {:command/name "repl-input-completions"
                          :repl-input.completion/request request
                          :repl-input.completion/options (completion/options (js->clj items :keywordize-keys true)
                                                                             (:repl-input/settings @host/!state))
                          :repl-input.completion/final? final?}))

(defn- items+
  "Returns a promise of the items from `f`, or of none when it fails."
  [f]
  (-> (js/Promise. (fn [resolve _] (resolve (f))))
      (.catch (fn [err]
                (js/console.error "Failed completing in the REPL Input:" err)
                #js []))))

(defn- repl-items+
  [{:repl-input.context/keys [ns session-key connected?]} doc offset]
  (if connected?
    (items+ #(.replCompletions ^js @host/!adapter session-key ns doc offset))
    (js/Promise.resolve #js [])))

(defn- request!
  "Asks the REPL for the candidates at `offset` of `doc`, for the `request` from the REPL Input `id`, and
   posts them."
  [{:keys [request offset] :repl-input/keys [id]} doc]
  (let [context (host/refresh-context!)
        answer {:repl-input/id id :request request :context context}]
    (swap! !completions assoc :in-flight {:request [id request]})
    (.then (repl-items+ context doc offset)
           (fn [repl-items]
             (when (in-flight? id request)
               (swap! !completions dissoc :in-flight)
               (answer! answer repl-items true))))))

(defn complete!
  "Completes at `offset` in `text` of the REPL Input `id`, for its `request`, and drops the answer to the
   request in flight. A request as you type answers with no candidates where `editor.quickSuggestions` is
   off."
  [{:keys [request text offset explicit?] :repl-input/keys [id] :as msg}]
  (let [doc (host/document {:repl-input/text text :repl-input/selections [[offset offset]]})
        cursor-contexts (js->clj (.cursorContexts ^js @host/!adapter doc))]
    (swap! !completions dissoc :in-flight)
    (if (completion/suggests? (:repl-input/settings @host/!state) cursor-contexts explicit?)
      (request! msg doc)
      (answer! {:repl-input/id id :request request} #js [] true))))

(defn- documentation
  [^js item]
  (let [docs (some-> item .-documentation)]
    (if (string? docs) docs (some-> docs .-value))))

(defn- resolve-item+
  [^js adapter ^js item {{:repl-input.context/keys [ns session-key]} :context}]
  (.resolveReplCompletion adapter session-key ns item))

(defn resolve!
  "Posts the docs of the candidate at `index` in the answer to `request` from the REPL Input `id`, or none
   when that REPL Input has been answered since."
  [{:keys [request index] :repl-input/keys [id]}]
  (let [{:keys [items] :as answer} (get-in @!completions [:answers id])
        item (when (= request (:request answer)) (aget items index))]
    (-> (if item
          (items+ #(resolve-item+ @host/!adapter item answer))
          (js/Promise.resolve nil))
        (.then (fn [resolved]
                 (host/post-to-view! id {:command/name "repl-input-completion-docs"
                                         :repl-input.completion/request request
                                         :repl-input.completion/index index
                                         :repl-input.completion/detail (some-> ^js resolved .-detail)
                                         :repl-input.completion/documentation (documentation resolved)}))))))

(defn active-changed!
  "Takes whether the completion list of the REPL Input `id` is `active?`, and sets the completion context
   keys when it has focus."
  [{:keys [active?] :repl-input/keys [id]}]
  (host/update-records! (fn [records]
                          (cond-> records
                            (contains? records id) (assoc-in [id :repl-input/completion-active?] (boolean active?)))))
  (host/apply-focused-contexts!))
