(ns calva.repl.webview.printed-code.actions
  "The actions of the printed code's editor in the Output view's page: a click turns a printed code block
   into a read-only editor, and the editor tells the extension its focus and selections, for Paredit to
   move and select in it."
  (:require
   [calva.repl.webview.code-brackets :as brackets]
   [calva.repl.webview.input.keys :as input-keys]))

(defn- post
  [db command & {:as more}]
  [:fx/post-to-host (merge {:command command :repl-input/id (:repl-input/id db)} more)])

(defn- at-version?
  [db {:keys [version]}]
  (= version (:printed-code/version db)))

(def ^:private next-version
  "The editor's versions count up for as long as the page lives, so the extension's answers for an earlier
   editor never match a later one."
  (fnil inc 0))

(defn handle-action
  [db [action-type payload]]
  (case action-type
    :printed-code/ax.clicked
    {:uf/db (update db :printed-code/version next-version)
     :uf/fxs [[:printed-code/fx.mount payload]]}

    :printed-code/ax.focused
    {:uf/db db
     :uf/fxs [(post db "printed-code-focused"
                    :version (:printed-code/version db)
                    :text (:text payload)
                    :selections (:selections payload))]}

    :printed-code/ax.changed
    (let [version (next-version (:printed-code/version db))]
      {:uf/db (assoc db :printed-code/version version)
       :uf/fxs [(post db "printed-code-changed" :version version :selections (:selections payload))]})

    :printed-code/ax.blurred
    {:uf/db db
     :uf/fxs [(post db "printed-code-blurred")]}

    :printed-code/ax.unmounted
    {:uf/db db
     :uf/fxs [(post db "printed-code-unmounted")]}

    :printed-code/ax.select
    (cond-> {:uf/db db}
      (at-version? db payload) (assoc :uf/fxs [[:printed-code/fx.set-selections (:selections payload)]]))

    :printed-code/ax.set-brackets
    (cond-> {:uf/db db}
      (at-version? db payload) (assoc :uf/fxs [[:printed-code/fx.set-marks (brackets/mark-ranges (:brackets payload))]]))

    :printed-code/ax.set-command-keys
    {:uf/db db
     :uf/fxs [[:printed-code/fx.set-command-keys (input-keys/command-keys payload)]]}

    :printed-code/ax.focus
    {:uf/db db
     :uf/fxs [[:printed-code/fx.focus]]}

    {:uf/db db}))
