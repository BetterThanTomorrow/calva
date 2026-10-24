(ns calva.repl.input.host
  "The extension's state for the REPL Inputs in the Output views, the context they evaluate in, their
   evaluations, and the messages they post."
  (:require
   [calva.repl.input.brackets :as brackets]
   [calva.repl.input.command-keys :as command-keys]
   [calva.repl.input.context :as context]
   [calva.repl.input.evaluations :as evaluations]
   [calva.repl.input.focus :as focus]
   [calva.repl.input.records :as records]
   [calva.repl.input.setting :as setting]
   [calva.util :as util]
   [clojure.set :as set]
   [clojure.string :as string]
   ["jsonc-parser" :as jsonc]))

(def focused-context "calva:replInputFocused")

(def reading-stdin-context "calva:replInputReadingStdin")

(def heights-key "calva.replInput.heights")

(def initial-state
  {:repl-input/records {}
   :repl-input/focused nil
   :repl-input/overrides {}
   :repl-input/keybindings []
   :repl-input/settings {}
   :repl-input/applied-cursor-contexts nil
   :repl-input/evaluations {}
   :repl-input/last-evaluation-id nil
   :repl-input/applied-reading-stdin? false
   :repl-input.context/lock nil
   :repl-input.context/editor nil
   :repl-input.context/line nil})

(defonce !state (atom initial-state))

(defonce !adapter (atom nil))

(defonce !views (atom {}))

(defonce ^{:doc "The NReplEvaluation and the stdin reply of each running evaluation, by evaluation id."}
  !running (atom {}))

(defn set-adapter!
  "Sets the adapter with the functions that call Calva's TypeScript code."
  [adapter]
  (reset! !adapter adapter))

(defn set-context!
  [k value]
  (some-> ^js @!adapter (.setContext k value)))

(defn current-setting
  []
  (when-let [vscode @util/vscode]
    (js->clj (.. ^js vscode -workspace (getConfiguration "calva") (get "outputViews.replInput")))))

(defn enabled?
  "True when the REPL Input is on for `view-id`."
  [view-id]
  (setting/enabled? (current-setting) (:repl-input/overrides @!state) view-id))

(defn toggle!
  [view-id]
  (swap! !state update :repl-input/overrides #(setting/toggle (current-setting) % view-id)))

(defn clear-toggles!
  []
  (swap! !state assoc :repl-input/overrides {}))

(defn view-title
  [view-id]
  (if (enabled? view-id) "REPL" "REPL Output"))

(defn- heights
  []
  (when-let [vscode-context @util/vscode-context]
    (js->clj (.. ^js vscode-context -globalState (get heights-key)))))

(defn- store-height!
  [{:keys [height] :repl-input/keys [id]}]
  (.. ^js @util/vscode-context -globalState (update heights-key (clj->js (assoc (heights) id height)))))

(defn html-state
  "What the Output view's page needs to mount the REPL Input for `view-id`."
  [view-id]
  {:repl-input/id view-id
   :repl-input/enabled? (enabled? view-id)
   :repl-input/height (get (heights) view-id)})

(defn- post-to-view!
  [id message]
  (when-let [^js view (get @!views id)]
    (.. view -webview (postMessage (pr-str (assoc message :repl-input/id id))))))

(defn- document
  [{:repl-input/keys [text selections selections-stack]}]
  (.document ^js @!adapter text (clj->js selections) (clj->js (or selections-stack []))))

(defn- document-state
  [doc]
  (let [{:keys [text selections selectionsStack]} (js->clj (.documentState ^js @!adapter doc) :keywordize-keys true)]
    {:text text
     :selections selections
     :selections-stack selectionsStack}))

(defn- apply-cursor-contexts!
  "Sets the focused REPL Input's cursor contexts that differ from the ones last set."
  []
  (let [{:repl-input/keys [focused records applied-cursor-contexts]} @!state]
    (when-let [contexts (get-in records [focused :repl-input/cursor-contexts])]
      (doseq [[k v] contexts
              :when (not= v (get applied-cursor-contexts k))]
        (set-context! k v))
      (swap! !state assoc :repl-input/applied-cursor-contexts contexts))))

(defn- release-cursor-contexts!
  "Gives the cursor contexts back to the active text editor, or clears them when no text editor takes them."
  []
  (when-let [applied (:repl-input/applied-cursor-contexts @!state)]
    (swap! !state assoc :repl-input/applied-cursor-contexts nil)
    (when-not (.restoreEditorCursorContexts ^js @!adapter)
      (doseq [[k v] applied
              :when v]
        (set-context! k false)))))

(defn- apply-reading-stdin-context!
  "Sets `calva:replInputReadingStdin` to whether an evaluation from the focused REPL Input waits for a
   line from stdin, when that changed."
  []
  (let [{:repl-input/keys [focused evaluations applied-reading-stdin?]} @!state
        reading? (some? (evaluations/waiting-for-stdin evaluations focused))]
    (when (not= reading? applied-reading-stdin?)
      (swap! !state assoc :repl-input/applied-reading-stdin? reading?)
      (set-context! reading-stdin-context reading?))))

(defn- update-focus!
  [event]
  (let [[before after] (swap-vals! !state update :repl-input/focused focus/focused-after event)
        focused? (some? (:repl-input/focused after))]
    (when (not= (some? (:repl-input/focused before)) focused?)
      (set-context! focused-context focused?))
    (if focused?
      (apply-cursor-contexts!)
      (release-cursor-contexts!))
    (apply-reading-stdin-context!)))

(defn- command-keys-for
  [{:repl-input/keys [keybindings settings]} record]
  (command-keys/command-keys keybindings
                             (command-keys/context settings record)
                             (get settings command-keys/user-keys-setting)))

(def ^:private derived-messages
  "The messages that post what the extension derives for a REPL Input, by the record key that holds it."
  {:repl-input/command-keys "repl-input-command-keys"
   :repl-input/editor-settings "repl-input-editor-settings"
   :repl-input/brackets "repl-input-brackets"})

(defn- document-brackets
  [settings doc]
  (js->clj (.brackets ^js @!adapter doc (clj->js (brackets/rainbow-options settings)))
           :keywordize-keys true))

(def ^:private editing-settings
  {"editor.multiCursorModifier" :multi-cursor-modifier
   "editor.wordSeparators" :word-separators})

(def clojure-settings
  "The settings read for Clojure, since they can be set per language."
  (concat brackets/close-settings (keys editing-settings)))

(defn- editor-settings
  [settings]
  (merge (brackets/editor-settings settings)
         (set/rename-keys (select-keys settings (keys editing-settings)) editing-settings)))

(defn- derive-record!
  "Derives the cursor contexts, the command keys, the editor settings and the brackets of the REPL Input
   `id` from its record and the settings, sets the cursor contexts when it has focus, and posts to it
   what changed."
  [id]
  (when-let [record (get-in @!state [:repl-input/records id])]
    (let [{:repl-input/keys [settings] :as state} @!state
          doc (document record)
          with-contexts (assoc record :repl-input/cursor-contexts (js->clj (.cursorContexts ^js @!adapter doc)))
          derived (assoc with-contexts
                         :repl-input/command-keys (command-keys-for state with-contexts)
                         :repl-input/editor-settings (editor-settings settings)
                         :repl-input/brackets (document-brackets settings doc))]
      (swap! !state assoc-in [:repl-input/records id] derived)
      (when (= id (:repl-input/focused @!state))
        (apply-cursor-contexts!))
      (doseq [[k command-name] derived-messages
              :when (not= (get record k) (get derived k))]
        (post-to-view! id {:command/name command-name
                           :repl-input/version (:repl-input/version record)
                           k (get derived k)})))))

(defn- derive-records!
  []
  (run! derive-record! (keys (:repl-input/records @!state))))

(defn- update-records!
  [f & args]
  (apply swap! !state update :repl-input/records f args))

(defn- take-record!
  [f {:repl-input/keys [id] :as msg}]
  (let [[before after] (swap-vals! !state update :repl-input/records f msg)]
    (when (not= (get-in before [:repl-input/records id]) (get-in after [:repl-input/records id]))
      (derive-record! id))))

(defn settings-changed!
  "Takes `settings`, a map from setting keys to values, and derives the REPL Inputs' command keys anew."
  [settings]
  (swap! !state assoc :repl-input/settings settings)
  (derive-records!))

(defn read-settings
  "The settings the command keys, the brackets and the editing depend on, as a map from setting keys to values."
  []
  (let [workspace (.-workspace ^js @util/vscode)
        read (fn [^js config ks]
               (into {} (map (fn [k] [k (js->clj (.get config k))])) ks))]
    (merge (read (.getConfiguration workspace)
                 (concat (command-keys/setting-keys (:repl-input/keybindings @!state))
                         [command-keys/user-keys-setting]
                         brackets/highlight-settings))
           (read (.getConfiguration workspace js/undefined #js {:languageId "clojure"})
                 clojure-settings))))

(def ^:private resolved-keybindings-uri "vscode://defaultsettings/keybindings.json")

(defn- platform
  []
  (case js/process.platform
    "darwin" "mac"
    "win32" "win"
    "linux"))

(defn- read-resolved-keybindings+
  []
  (let [^js vscode @util/vscode]
    (-> (.. vscode -workspace (openTextDocument (.. vscode -Uri (parse resolved-keybindings-uri))))
        (.then (fn [^js doc]
                 (js->clj (jsonc/parse (.getText doc)) :keywordize-keys true))))))

(defn load-keybindings!
  "Reads the keys VS Code resolved for Calva's keybindings with the current keyboard layout, falling back
   on the manifest's keys for the platform, and derives the REPL Inputs' command keys from them."
  []
  (when-let [^js vscode-context @util/vscode-context]
    (let [manifest (js->clj (.. vscode-context -extension -packageJSON -contributes -keybindings) :keywordize-keys true)
          fallback #(command-keys/platform-keybindings manifest (platform))]
      (-> (read-resolved-keybindings+)
          (.then (fn [resolved]
                   (let [keybindings (command-keys/calva-keybindings manifest resolved)]
                     (if (seq keybindings) keybindings (fallback)))))
          (.catch fallback)
          (.then (fn [keybindings]
                   (swap! !state assoc :repl-input/keybindings (command-keys/parsed keybindings))
                   (settings-changed! (read-settings))))))))

(defn- editor-namespace
  [{:keys [document position]}]
  (when document
    (let [[ns ns-form] (.editorNamespace ^js @!adapter document position)]
      {:repl-input.context/ns ns
       :repl-input.context/ns-form ns-form})))

(defn- current-context
  []
  (let [{:repl-input.context/keys [lock editor]} @!state
        ^js adapter @!adapter]
    (context/current {:lock lock
                      :editor-namespace (editor-namespace editor)
                      :routed-session-key (.routedSessionKey adapter (:document editor))
                      :session-keys (.sessionKeys adapter)})))

(defn- context-line-message
  [line]
  {:command/name "repl-input-context"
   :repl-input/context-line line})

(defn- refresh-context!
  "Works out the context, posts its line to the REPL Inputs when the line changed, and returns the context."
  []
  (let [current (current-context)
        line (context/line current)
        [before _] (swap-vals! !state assoc :repl-input.context/line line)]
    (when (not= line (:repl-input.context/line before))
      (doseq [id (keys (:repl-input/records @!state))]
        (post-to-view! id (context-line-message line))))
    current))

(defn- refresh-mounted-context!
  []
  (when (and @!adapter (seq (:repl-input/records @!state)))
    (refresh-context!)))

(defn ^:export editor-moved!
  "Follows the Clojure editor with `document`, now at `position`."
  [document position]
  (swap! !state assoc :repl-input.context/editor {:document document :position position})
  (refresh-mounted-context!))

(defn ^:export routing-changed!
  "Updates the context line after sessions connected, disconnected or changed routing."
  []
  (refresh-mounted-context!))

(defn- follow-editor!
  []
  (swap! !state assoc :repl-input.context/lock nil)
  (refresh-context!))

(defn- evaluation-message
  [id]
  {:command/name "repl-input-evaluation"
   :repl-input/evaluation (evaluations/bar (:repl-input/evaluations @!state) id)})

(defn- mounted!
  [id]
  (refresh-context!)
  (post-to-view! id (context-line-message (:repl-input.context/line @!state)))
  (post-to-view! id (evaluation-message id)))

(def ^:private empty-text
  {:text "" :selections [[0 0]] :selections-stack []})

(defn- take-edit!
  "Takes `after`, an edit the extension made from `version` of the REPL Input `id`, and posts it to that
   REPL Input."
  [id version {:keys [text selections] :as after}]
  (let [[old new] (swap-vals! !state update :repl-input/records records/take-edit id version after)]
    (when (not= old new)
      (post-to-view! id {:command/name "repl-input-edit"
                         :repl-input/version version
                         :text text
                         :selections selections})
      (derive-record! id))))

(defn- update-evaluations!
  [id f & args]
  (apply swap! !state update :repl-input/evaluations f id args)
  (post-to-view! id (evaluation-message id))
  (apply-reading-stdin-context!))

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
  (swap! !state update :repl-input.context/lock context/lock-after evaluation-context code-namespace succeeded?)
  (update-evaluations! id evaluations/finished evaluation-id)
  (refresh-context!))

(defn- evaluate+
  "Evaluates `code` from the REPL Input `id` in `evaluation-context`. Returns a promise of when it is done."
  [id code {:repl-input.context/keys [ns ns-form session-key] :as evaluation-context}]
  (let [^js adapter @!adapter
        evaluation-id (:repl-input/last-evaluation-id
                       (swap! !state update :repl-input/last-evaluation-id evaluations/next-id (js/Date.now)))
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
                                :stdin #(read-stdin+ id evaluation-id)
                                :onSent #(swap! !running assoc-in [evaluation-id :evaluation] %)})
        (.then (fn [^js outcome] (.-succeeded outcome))
               (constantly false))
        (.then #(evaluated! evaluation %)))))

(defn- show-message!
  [message]
  (some-> ^js @util/vscode .-window (.showInformationMessage message)))

(defn ^:export evaluate-focused!
  "Evaluates the focused REPL Input's text in the context and clears the REPL Input, or says that no
   session answers to the context's session key. Returns a promise of when the evaluation is done."
  []
  (let [{:repl-input/keys [focused records]} @!state
        {:repl-input/keys [text version]} (get records focused)]
    (if (string/blank? text)
      (js/Promise.resolve nil)
      (let [evaluation-context (refresh-context!)]
        (if (:repl-input.context/connected? evaluation-context)
          (do (take-edit! focused version empty-text)
              (evaluate+ focused text evaluation-context))
          (js/Promise.resolve (show-message! (context/not-connected-message evaluation-context))))))))

(defn ^:export send-line!
  "Sends the focused REPL Input's text as the line the evaluation waiting for stdin reads, and clears
   the REPL Input."
  []
  (let [{:repl-input/keys [focused records] :as state} @!state
        evaluation-id (evaluations/waiting-for-stdin (:repl-input/evaluations state) focused)
        {:repl-input/keys [text version]} (get records focused)]
    (when-let [send (get-in @!running [evaluation-id :send-line])]
      (swap! !running update evaluation-id dissoc :send-line)
      (update-evaluations! focused evaluations/reading-stdin evaluation-id false)
      (take-edit! focused version empty-text)
      (send (or text "")))))

(defn- interrupt-evaluation!
  "Interrupts the NReplEvaluation `evaluation`. One that has had no reply yet isn't running to
   NReplEvaluation, so its session interrupts it."
  [^js evaluation]
  (if (.-running evaluation)
    (.interrupt evaluation)
    (-> (.. evaluation -session (interrupt (.-id evaluation)))
        (.catch #(js/console.error "Failed interrupting the REPL Input evaluation:" %)))))

(defn- interrupt!
  [id]
  (doseq [evaluation-id (keys (get-in @!state [:repl-input/evaluations id]))]
    (some-> (get-in @!running [evaluation-id :evaluation]) interrupt-evaluation!)))

(defn ^:export interrupt-focused!
  "Interrupts the evaluations running from the focused REPL Input."
  []
  (some-> (:repl-input/focused @!state) interrupt!))

(defn handle-message!
  "Takes a message the REPL Input in `webview-host` posted."
  [^js webview-host ^js message]
  (let [{:keys [command] :repl-input/keys [id] :as msg} (js->clj message :keywordize-keys true)]
    (case command
      "repl-input-mounted" (do (swap! !views assoc id webview-host)
                               (take-record! records/take-mount msg)
                               (mounted! id)
                               (load-keybindings!))
      "repl-input-changed" (take-record! records/take-change msg)
      "repl-input-unmounted" (do (update-records! records/remove-record id)
                                 (update-focus! [:unmount id]))
      "repl-input-focused" (update-focus! [:focus id])
      "repl-input-blurred" (update-focus! [:blur id])
      "repl-input-resized" (store-height! msg)
      "repl-input-follow-editor" (follow-editor!)
      "repl-input-interrupt" (interrupt! id)
      nil)))

(defn listen-for-messages!
  [^js webview-host]
  (when-let [webview (some-> webview-host .-webview)]
    (when (fn? (.-onDidReceiveMessage webview))
      (.onDidReceiveMessage webview #(handle-message! webview-host %)))))

(defn view-disposed!
  [view-id]
  (swap! !views dissoc view-id)
  (update-records! records/remove-record view-id)
  (update-focus! [:dispose view-id]))

(defn view-hidden!
  [view-id]
  (update-focus! [:hide view-id]))

(defn ^:export focused?
  "True while a REPL Input has focus."
  []
  (some? (:repl-input/focused @!state)))

(defn ^:export text-editor-focused!
  []
  (update-focus! [:text-editor-focus]))

(defn- edited!
  [id version before doc]
  (let [after (document-state doc)]
    (when (not= (dissoc before :selections-stack) (dissoc after :selections-stack))
      (take-edit! id version after))))

(defn ^:export run-in-focused!
  "Runs the REPL Input's editor command named `command-name` in the focused REPL Input."
  [command-name]
  (when-let [focused (:repl-input/focused @!state)]
    (post-to-view! focused {:command/name "repl-input-run-command"
                            :repl-input/command command-name})))

(defn ^:export edit-focused!
  "Runs `f` on a document with the focused REPL Input's text and selections, and posts what `f` made of
   them to that REPL Input. Returns a promise of when that is done."
  [f]
  (let [{:repl-input/keys [focused records]} @!state]
    (if-let [{:repl-input/keys [version] :as record} (get records focused)]
      (let [doc (document record)
            before (document-state doc)]
        (-> (js/Promise.resolve (f doc))
            (.then (fn [_] (edited! focused version before doc)))))
      (js/Promise.resolve nil))))
