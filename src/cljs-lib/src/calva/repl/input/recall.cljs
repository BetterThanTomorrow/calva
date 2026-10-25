(ns calva.repl.input.recall
  "Recalls what the REPL Inputs evaluated: keeps the history in `workspaceState`, gives the REPL Inputs
   the entries they walk with `up` and `down`, and searches them in a quick pick."
  (:require
   [calva.repl.input.config :as config]
   [calva.repl.input.history :as history]
   [calva.repl.input.host :as host]
   [calva.util :as util]))

(defn load-history!
  []
  (swap! host/!state assoc :repl-input.history/entries (history/from-stored (config/history))))

(defn add!
  "Adds `code`, evaluated from the REPL Input `id` in `context`, to the history, and gives that REPL Input
   the entries it walks anew, which ends its walk."
  [id code context]
  (let [[before after] (swap-vals! host/!state update :repl-input.history/entries history/add (history/entry code context))
        entries (:repl-input.history/entries after)]
    (when (not= entries (:repl-input.history/entries before))
      (config/store-history! (history/stored entries)))
    (when-not (host/refresh-history!)
      (host/post-to-view! id (host/history-message (:repl-input.history/walked @host/!state))))))

(defn- recall!
  "Shows the entry at `position` of the entries that the REPL Input `id` walks."
  [id position]
  (host/post-to-view! id {:command/name "repl-input-recall"
                          :repl-input.history/position position}))

(defn ^:export search-focused!
  "Searches the history in a quick pick, newest first, and shows the picked entry in the REPL Input that
   Calva's commands reach. Returns a promise of when that is done."
  []
  (if-let [target (host/command-target @host/!state)]
    (do
      (host/refresh-context!)
      (-> (.. ^js @util/vscode -window
              (showQuickPick (clj->js (history/pick-items (:repl-input.history/walked @host/!state)))
                             #js {:placeHolder "Search the REPL Input history"
                                  :matchOnDescription true}))
          (.then #(some->> % .-index (recall! target)))))
    (js/Promise.resolve nil)))
