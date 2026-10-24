(ns calva.repl.input.recall
  "Recalls what the REPL Inputs evaluated: keeps the history in `workspaceState`, walks it with `up` and
   `down`, and searches it in a quick pick."
  (:require
   [calva.repl.input.config :as config]
   [calva.repl.input.history :as history]
   [calva.repl.input.host :as host]
   [calva.util :as util]))

(defn load-history!
  []
  (swap! host/!state assoc :repl-input.history/entries (history/from-stored (config/history))))

(defn- stop-walking
  [state id]
  (cond-> state
    (get-in state [:repl-input/records id])
    (update-in [:repl-input/records id] dissoc :repl-input.history/position :repl-input.history/stash)))

(defn add!
  "Adds `code`, evaluated from the REPL Input `id` in `context`, to the history, and ends that REPL
   Input's walk."
  [id code context]
  (let [[before after] (swap-vals! host/!state
                                   #(-> %
                                        (update :repl-input.history/entries history/add (history/entry code context))
                                        (stop-walking id)))
        entries (:repl-input.history/entries after)]
    (when (not= entries (:repl-input.history/entries before))
      (config/store-history! (history/stored entries)))))

(defn- visible-entries
  [{:repl-input.history/keys [entries] :repl-input/keys [settings]} {:repl-input.context/keys [session-key]}]
  (history/visible entries session-key (get settings history/per-session-setting)))

(defn walk!
  "Walks the history `direction`, `:back` or `:forward`, in the REPL Input `id`."
  [id direction]
  (let [{:repl-input/keys [records] :repl-input.context/keys [lock] :as state} @host/!state
        context (host/refresh-context!)
        {:repl-input/keys [version] :as record} (get records id)
        {:keys [text selections position stash] walked-lock :lock :as walked}
        (when record
          (history/walked (visible-entries state context) record {:lock lock :context context} direction))]
    (when (and walked
               (host/take-edit! id version {:text text :selections selections :selections-stack []}))
      (swap! host/!state #(-> %
                              (assoc :repl-input.context/lock walked-lock)
                              (update-in [:repl-input/records id] assoc
                                         :repl-input.history/position position
                                         :repl-input.history/stash stash)))
      (host/refresh-context!))))

(defn- recall!
  "Shows `entry` in the REPL Input `id`, and locks the entry's context when it is another one."
  [id entry]
  (let [{:repl-input/keys [records] :repl-input.context/keys [lock]} @host/!state
        context (host/refresh-context!)
        {:keys [text selections]} (history/shown-text (:repl-input.history/code entry) :forward)]
    (when (host/take-edit! id (get-in records [id :repl-input/version]) {:text text :selections selections :selections-stack []})
      (swap! host/!state #(-> %
                              (assoc :repl-input.context/lock (history/recalled-lock lock context entry))
                              (stop-walking id)))
      (host/refresh-context!))))

(defn ^:export search-focused!
  "Searches the history in a quick pick, newest first, and recalls the picked entry in the focused REPL
   Input. Returns a promise of when that is done."
  []
  (let [{:repl-input/keys [focused] :as state} @host/!state]
    (if focused
      (let [entries (visible-entries state (host/refresh-context!))]
        (-> (.. ^js @util/vscode -window
                (showQuickPick (clj->js (history/pick-items entries))
                               #js {:placeHolder "Search the REPL Input history"
                                    :matchOnDescription true}))
            (.then #(some->> % .-index (get entries) (recall! focused)))))
      (js/Promise.resolve nil))))
