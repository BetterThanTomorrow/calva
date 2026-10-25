(ns calva.repl.input.host
  "The extension's state for the REPL Inputs in the Output views: their records, their focus, what the
   extension derives for them and posts to them, and the context they evaluate in."
  (:require
   [calva.repl.input.brackets :as brackets]
   [calva.repl.input.command-keys :as command-keys]
   [calva.repl.input.completion :as completion]
   [calva.repl.input.config :as config]
   [calva.repl.input.context :as context]
   [calva.repl.input.focus :as focus]
   [calva.repl.input.history :as history]
   [calva.repl.input.records :as records]
   [calva.repl.input.setting :as setting]
   [calva.state :as state]
   [calva.util :as util]))

(def focused-context "calva:replInputFocused")

(def last-focused-context "calva:replInputLastFocused")

(defn- focused-contexts
  "The context keys that hold only for the focused REPL Input: whether its completion list is open."
  [{:repl-input/keys [focused records settings]}]
  (completion/contexts (get-in records [focused :repl-input/completion-active?]) settings))

(def initial-state
  {:repl-input/records {}
   :repl-input/focused nil
   :repl-input/last-focused nil
   :repl-input/overrides {}
   :repl-input/keybindings []
   :repl-input/settings {}
   :repl-input/applied-cursor-contexts nil
   :repl-input/evaluations {}
   :repl-input/last-evaluation-id nil
   :repl-input/evaluated-code []
   :repl-input/applied-focused-contexts (focused-contexts {})
   :repl-input/connected? false
   :repl-input.context/lock nil
   :repl-input.context/editor nil
   :repl-input.context/line nil
   :repl-input.history/entries []
   :repl-input.history/walked []})

(defonce !state (atom initial-state))

(defonce !adapter (atom nil))

(defonce !views (atom {}))

(defn set-adapter!
  "Sets the adapter with the functions that call Calva's TypeScript code."
  [adapter]
  (reset! !adapter adapter))

(defn set-context!
  [k value]
  (some-> ^js @!adapter (.setContext k value)))

(defn enabled?
  "True when the REPL Input is on for `view-id`."
  [view-id]
  (setting/enabled? (config/current-setting) (:repl-input/overrides @!state) view-id))

(defn toggle!
  [view-id]
  (swap! !state update :repl-input/overrides #(setting/toggle (config/current-setting) % view-id)))

(defn clear-toggles!
  []
  (swap! !state assoc :repl-input/overrides {}))

(defn view-title
  [view-id]
  (if (enabled? view-id) "REPL" "REPL Output"))

(defn html-state
  "What the Output view's page needs to mount the REPL Input for `view-id`."
  [view-id]
  {:repl-input/id view-id
   :repl-input/enabled? (enabled? view-id)
   :repl-input/height (get (config/heights) view-id)})

(defn post-to-view!
  [id message]
  (when-let [^js view (get @!views id)]
    (.. view -webview (postMessage (pr-str (assoc message :repl-input/id id))))))

(def focus-message {:command/name "repl-input-focus"})

(defn history-message
  [entries]
  {:command/name "repl-input-history"
   :repl-input.history/entries entries})

(defn- walked-history
  "Returns the history entries that the REPL Inputs walk: those evaluated in the context line's session
   when the history is kept per session, else all of them."
  [{:repl-input.history/keys [entries] :repl-input/keys [settings] :repl-input.context/keys [line]}]
  (history/visible entries (:repl-input.context/session-key line) (get settings history/per-session-setting)))

(defn refresh-history!
  "Posts the history entries that the REPL Inputs walk to them when the entries changed. Returns true when
   it posted them."
  []
  (let [walked (walked-history @!state)
        [before _] (swap-vals! !state assoc :repl-input.history/walked walked)]
    (when (not= walked (:repl-input.history/walked before))
      (doseq [id (keys (:repl-input/records @!state))]
        (post-to-view! id (history-message walked)))
      true)))

(defn document
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

(defn apply-focused-contexts!
  "Sets the context keys that hold only for the focused REPL Input, those that changed: whether its
   completion list is open."
  []
  (let [{:repl-input/keys [applied-focused-contexts] :as state} @!state
        contexts (focused-contexts state)]
    (doseq [[k v] contexts
            :when (not= v (get applied-focused-contexts k))]
      (set-context! k v))
    (swap! !state assoc :repl-input/applied-focused-contexts contexts)))

(defn- set-context-on-change!
  "Sets the context key `k` to whether there is a REPL Input id `after`, when that differs from `before`."
  [k before after]
  (when (not= (some? before) (some? after))
    (set-context! k (some? after))))

(defn update-focus!
  [event]
  (let [[before after] (swap-vals! !state #(-> %
                                               (update :repl-input/focused focus/focused-after event)
                                               (update :repl-input/last-focused focus/last-focused-after event)))
        focused? (some? (:repl-input/focused after))]
    (set-context-on-change! focused-context (:repl-input/focused before) (:repl-input/focused after))
    (set-context-on-change! last-focused-context (:repl-input/last-focused before) (:repl-input/last-focused after))
    (if focused?
      (apply-cursor-contexts!)
      (release-cursor-contexts!))
    (apply-focused-contexts!)))

(defn- command-keys-for
  "The command keys of `record`, with `:completion-list-keys`, the keys of those that hold while its
   completion list is open."
  [{:repl-input/keys [keybindings settings] :as state} record]
  (let [context (command-keys/context state record)
        user-keys (get settings command-keys/user-keys-setting)]
    (assoc (command-keys/command-keys keybindings context user-keys)
           :completion-list-keys (:keys (command-keys/command-keys keybindings
                                                                   (merge context (completion/contexts true settings))
                                                                   user-keys)))))

(def ^:private derived-messages
  "The messages that post what the extension derives for a REPL Input, by the record key that holds it."
  {:repl-input/command-keys "repl-input-command-keys"
   :repl-input/editor-settings "repl-input-editor-settings"
   :repl-input/brackets "repl-input-brackets"})

(defn- document-brackets
  [settings doc]
  (js->clj (.brackets ^js @!adapter doc (clj->js (brackets/rainbow-options settings)))
           :keywordize-keys true))

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
                         :repl-input/editor-settings (config/editor-settings settings)
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

(defn update-records!
  [f & args]
  (apply swap! !state update :repl-input/records f args))

(defn take-record!
  [f {:repl-input/keys [id] :as msg}]
  (let [[before after] (swap-vals! !state update :repl-input/records f msg)]
    (when (not= (get-in before [:repl-input/records id]) (get-in after [:repl-input/records id]))
      (derive-record! id))))

(defn settings-changed!
  "Takes `settings`, a map from setting keys to values, and derives the REPL Inputs' command keys and
   history anew."
  [settings]
  (swap! !state assoc :repl-input/settings settings)
  (derive-records!)
  (refresh-history!))

(defn read-settings
  "The settings the command keys, the brackets and the editing depend on, as a map from setting keys to values."
  []
  (config/read-settings (:repl-input/keybindings @!state)))

(defn load-keybindings!
  "Reads the keys VS Code resolved for Calva's keybindings with the current keyboard layout, falling back
   on the manifest's keys for the platform, and derives the REPL Inputs' command keys from them."
  []
  (when-let [vscode-context @util/vscode-context]
    (.then (config/read-keybindings+ vscode-context)
           (fn [keybindings]
             (swap! !state assoc :repl-input/keybindings (command-keys/parsed keybindings))
             (settings-changed! (read-settings))))))

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

(defn context-line-message
  [line]
  {:command/name "repl-input-context"
   :repl-input/context-line line})

(defn refresh-context!
  "Works out the context, posts its line, and the history in its session, to the REPL Inputs when the line
   changed, and returns the context."
  []
  (let [current (current-context)
        line (context/line current)
        [before _] (swap-vals! !state assoc :repl-input.context/line line)]
    (when (not= line (:repl-input.context/line before))
      (doseq [id (keys (:repl-input/records @!state))]
        (post-to-view! id (context-line-message line)))
      (refresh-history!))
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
  "Updates the context line after sessions connected, disconnected or changed routing, and the command
   keys when the REPL connected or disconnected."
  []
  (let [connected? (boolean (state/get-state-value "connected"))
        [before _] (swap-vals! !state assoc :repl-input/connected? connected?)]
    (when (not= connected? (:repl-input/connected? before))
      (derive-records!)))
  (refresh-mounted-context!))

(defn follow-editor!
  []
  (swap! !state assoc :repl-input.context/lock nil)
  (refresh-context!))

(defn lock!
  "Locks the namespace, `ns` form and session of `context`."
  [context]
  (swap! !state assoc :repl-input.context/lock (select-keys context [:repl-input.context/ns
                                                                      :repl-input.context/ns-form
                                                                      :repl-input.context/session-key]))
  (refresh-context!))

(def empty-text
  {:text "" :selections [[0 0]] :selections-stack []})

(defn take-edit!
  "Takes `after`, an edit the extension made from `version` of the REPL Input `id`, and posts it to that
   REPL Input. Returns true when the REPL Input was still at `version`."
  [id version {:keys [text selections] :as after}]
  (let [[old new] (swap-vals! !state update :repl-input/records records/take-edit id version after)]
    (when (not= old new)
      (post-to-view! id {:command/name "repl-input-edit"
                         :repl-input/version version
                         :text text
                         :selections selections})
      (derive-record! id)
      true)))

(defn view-disposed!
  [view-id]
  (swap! !views dissoc view-id)
  (update-records! records/remove-record view-id)
  (update-focus! [:dispose view-id]))

(defn view-hidden!
  [view-id]
  (update-focus! [:hide view-id]))

(defn view-state-changed!
  "Takes whether the view `view-id` is `visible?` and `active?`."
  [view-id visible? active?]
  (cond
    (not visible?) (update-focus! [:hide view-id])
    (not active?) (update-focus! [:deactivate view-id])))

(defn command-target
  "Returns the id of the REPL Input that Calva's commands reach in `state`: the focused one, or else the
   last focused place, as while the command palette has the focus."
  [{:repl-input/keys [focused last-focused]}]
  (or focused last-focused))

(defn- focus-view!
  "Gives the focus to the REPL Input `id` in its view."
  [id]
  (when-let [^js view (get @!views id)]
    (if (fn? (.-reveal view))
      (.reveal view js/undefined false)
      (.show view false))
    (post-to-view! id focus-message)))

(defn command-target!
  "Returns the id of the REPL Input that Calva's commands reach, and gives the focus back to it when it is
   the last focused place."
  []
  (let [{:repl-input/keys [focused] :as state} @!state
        target (command-target state)]
    (when (and target (not focused))
      (focus-view! target))
    target))

(defn ^:export focused?
  "True while Calva's commands reach a REPL Input: while one has focus, or is the last focused place."
  []
  (some? (command-target @!state)))

(defn terminal-focused!
  []
  (update-focus! [:terminal-focus]))

(defn ^:export text-editor-focused!
  []
  (update-focus! [:text-editor-focus]))

(defn- edited!
  [id version before doc]
  (let [after (document-state doc)]
    (when (not= (dissoc before :selections-stack) (dissoc after :selections-stack))
      (take-edit! id version after))))

(defn ^:export run-in-focused!
  "Runs the REPL Input's editor command named `command-name` in the REPL Input that Calva's commands reach."
  [command-name]
  (when-let [target (command-target!)]
    (post-to-view! target {:command/name "repl-input-run-command"
                           :repl-input/command command-name})))

(defn ^:export edit-focused!
  "Runs `f` on a document with the text and selections of the REPL Input that Calva's commands reach, and
   posts what `f` made of them to that REPL Input. Returns a promise of when that is done."
  [f]
  (let [target (command-target!)]
    (if-let [{:repl-input/keys [version] :as record} (get-in @!state [:repl-input/records target])]
      (let [doc (document record)
            before (document-state doc)]
        (-> (js/Promise.resolve (f doc))
            (.then (fn [_] (edited! target version before doc)))))
      (js/Promise.resolve nil))))
