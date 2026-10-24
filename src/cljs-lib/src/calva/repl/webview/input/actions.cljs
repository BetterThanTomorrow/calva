(ns calva.repl.webview.input.actions
  "The REPL Input's actions in the Output view's page.")

(def min-height 40)

(def view-margin 40)

(defn- post
  [db command & {:as more}]
  [:fx/post-to-host (merge {:command command :repl-input/id (:repl-input/id db)} more)])

(defn- clamp-height
  [height view-height]
  (js/Math.round (max min-height (min height (- view-height view-margin)))))

(defn- set-enabled
  [db enabled?]
  (cond
    (= (boolean enabled?) (boolean (:repl-input/enabled? db)))
    {:uf/db db}

    enabled?
    {:uf/db (assoc db :repl-input/enabled? true :repl-input/version 0)
     :uf/fxs [[:repl-input/fx.mount {:height (:repl-input/height db)}]]}

    :else
    {:uf/db (assoc db :repl-input/enabled? false)
     :uf/fxs [[:repl-input/fx.unmount]
              (post db "repl-input-unmounted")]}))

(defn handle-action
  [db [action-type payload]]
  (case action-type
    :repl-input/ax.init
    (let [{:repl-input/keys [id height enabled?]} payload]
      (set-enabled (assoc db :repl-input/id id :repl-input/height height) enabled?))

    :repl-input/ax.set-enabled
    (set-enabled db payload)

    :repl-input/ax.mounted
    {:uf/db db
     :uf/fxs [(post db "repl-input-mounted" :version (:repl-input/version db) :text (:text payload) :selections (:selections payload))]}

    :repl-input/ax.changed
    (let [version (inc (:repl-input/version db))]
      {:uf/db (assoc db :repl-input/version version)
       :uf/fxs [(post db "repl-input-changed" :version version :text (:text payload) :selections (:selections payload))]})

    :repl-input/ax.focused
    {:uf/db db
     :uf/fxs [(post db "repl-input-focused")]}

    :repl-input/ax.blurred
    {:uf/db db
     :uf/fxs [(post db "repl-input-blurred")]}

    :repl-input/ax.drag
    (let [height (clamp-height (:height payload) (:view-height payload))]
      {:uf/db (assoc db :repl-input/height height)
       :uf/fxs [[:repl-input/fx.set-height {:height height :dragging? true}]]})

    :repl-input/ax.drag-ended
    {:uf/db db
     :uf/fxs [[:repl-input/fx.set-height {:height (:repl-input/height db) :dragging? false}]
              (post db "repl-input-resized" :height (:repl-input/height db))]}

    {:uf/db db}))
