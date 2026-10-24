(ns calva.repl.input.host
  "The extension's state for the REPL Inputs in the Output views, and the messages they post."
  (:require
   [calva.repl.input.focus :as focus]
   [calva.repl.input.records :as records]
   [calva.repl.input.setting :as setting]
   [calva.util :as util]))

(def focused-context "calva:replInputFocused")

(def heights-key "calva.replInput.heights")

(defonce !state (atom {:repl-input/records {}
                       :repl-input/focused nil
                       :repl-input/overrides {}}))

(defonce !set-context (atom (fn [_key _value])))

(defn set-set-context-fn!
  "Sets the function that sets a VS Code context key to a value."
  [f]
  (reset! !set-context f))

(defn set-context!
  [k value]
  (@!set-context k value))

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

(defn- update-focus!
  [event]
  (let [[before after] (swap-vals! !state update :repl-input/focused focus/focused-after event)
        focused? (some? (:repl-input/focused after))]
    (when (not= (some? (:repl-input/focused before)) focused?)
      (set-context! focused-context focused?))))

(defn- update-records!
  [f & args]
  (apply swap! !state update :repl-input/records f args))

(defn handle-message!
  "Takes a message a REPL Input posted."
  [^js message]
  (let [{:keys [command] :repl-input/keys [id] :as msg} (js->clj message :keywordize-keys true)]
    (case command
      "repl-input-mounted" (update-records! records/take-mount msg)
      "repl-input-changed" (update-records! records/take-change msg)
      "repl-input-unmounted" (do (update-records! records/remove-record id)
                                 (update-focus! [:unmount id]))
      "repl-input-focused" (update-focus! [:focus id])
      "repl-input-blurred" (update-focus! [:blur id])
      "repl-input-resized" (store-height! msg)
      nil)))

(defn listen-for-messages!
  [^js webview-host]
  (when-let [webview (some-> webview-host .-webview)]
    (when (fn? (.-onDidReceiveMessage webview))
      (.onDidReceiveMessage webview handle-message!))))

(defn view-disposed!
  [view-id]
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
