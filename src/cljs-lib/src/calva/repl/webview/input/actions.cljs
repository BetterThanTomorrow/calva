(ns calva.repl.webview.input.actions
  "The REPL Input's actions in the Output view's page."
  (:require
   [calva.repl.webview.input.brackets :as brackets]
   [calva.repl.webview.input.history :as history]
   [calva.repl.webview.input.keys :as input-keys]))

(def view-margin 40)

(defn- post
  [db command & {:as more}]
  [:fx/post-to-host (merge {:command command :repl-input/id (:repl-input/id db)} more)])

(defn- clamp-height
  [{:keys [height min-height view-height]}]
  (js/Math.round (max min-height (min height (- view-height view-margin)))))

(defn controls-state
  "Returns what the REPL Input's controls show for `db`: the context line, the lock of the recalled history
   entry, the evaluation, whether the namespace menu is open, and whether the sash is dragged."
  [{:repl-input/keys [context-line evaluation namespace-menu-open? dragging?] :as db}]
  {:repl-input/context-line context-line
   :repl-input/recalled-lock (history/recalled-lock db)
   :repl-input/evaluation evaluation
   :repl-input/namespace-menu-open? (boolean namespace-menu-open?)
   :repl-input/dragging? (boolean dragging?)})

(defn- render-fxs
  "Draws the REPL Input's controls for `db`, while the REPL Input is on."
  [db]
  (when (:repl-input/enabled? db)
    [[:repl-input/fx.render-controls (controls-state db)]]))

(defn- set-enabled
  [db enabled?]
  (cond
    (= (boolean enabled?) (boolean (:repl-input/enabled? db)))
    {:uf/db db}

    enabled?
    (let [enabled (-> db
                      (assoc :repl-input/enabled? true :repl-input/version 0)
                      history/walk-ended)]
      {:uf/db enabled
       :uf/fxs [[:repl-input/fx.mount {:height (:repl-input/height db)
                                       :controls (controls-state enabled)}]]})

    :else
    {:uf/db (-> db
                (assoc :repl-input/enabled? false)
                (dissoc :repl-input/evaluation :repl-input/namespace-menu-open? :repl-input/dragging?))
     :uf/fxs [[:repl-input/fx.unmount]
              (post db "repl-input-unmounted")]}))

(defn- completion-config
  "The completion settings, with completion on once the extension has posted them."
  [{:repl-input/keys [completion-settings]}]
  (assoc completion-settings :enabled? (some? completion-settings)))

(defn- set-editor-settings
  [db settings]
  (let [db (assoc db :repl-input/completion-settings (:completion settings))]
    {:uf/db db
     :uf/fxs [[:repl-input/fx.set-close-brackets (:close-brackets settings)]
              [:repl-input/fx.set-bracket-css (brackets/css (:bracket-styles settings))]
              [:repl-input/fx.set-editing (select-keys settings [:multi-cursor-modifier :word-separators])]
              [:repl-input/fx.set-completion (completion-config db)]]}))

(defn- handle-completion-action
  "Handles the actions of the completion list and its docs, and of go to definition."
  [db [action-type payload]]
  (case action-type
    :repl-input/ax.complete
    (let [{:keys [request text offset explicit?]} payload]
      {:uf/db db
       :uf/fxs [(post db "repl-input-complete" :request request :text text :offset offset :explicit? explicit?)]})

    :repl-input/ax.completions
    {:uf/db db
     :uf/fxs [[:repl-input/fx.deliver-completions payload]]}

    :repl-input/ax.resolve-completion
    {:uf/db db
     :uf/fxs [(post db "repl-input-resolve-completion" :request (:request payload) :index (:index payload))]}

    :repl-input/ax.completion-docs
    {:uf/db db
     :uf/fxs [[:repl-input/fx.deliver-completion-docs payload]]}

    :repl-input/ax.completion-active
    (if (= (boolean payload) (boolean (:repl-input/completion-active? db)))
      {:uf/db db}
      {:uf/db (assoc db :repl-input/completion-active? (boolean payload))
       :uf/fxs [(post db "repl-input-completion-active" :active? (boolean payload))]})

    :repl-input/ax.reveal-definition
    {:uf/db db
     :uf/fxs [(post db "repl-input-reveal-definition" :text (:text payload) :offset (:offset payload))]}

    {:uf/db db}))

(defn- reading-stdin?
  [evaluation]
  (= :reading-stdin evaluation))

(defn- evaluation-fxs
  "Draws the REPL Input's controls for `db`, whose evaluation went from `before`, while the REPL Input is
   on. The stdin input is emptied before it hides, and gets the focus after it shows."
  [before {after :repl-input/evaluation :as db}]
  (when (:repl-input/enabled? db)
    (cond-> []
      (and (reading-stdin? before) (not (reading-stdin? after))) (conj [:repl-input/fx.hide-stdin])
      :always (into (render-fxs db))
      (and (reading-stdin? after) (not (reading-stdin? before))) (conj [:repl-input/fx.show-stdin]))))

(defn- mode-fx
  "Asks the extension for the `mode-change` that the history asks for: a lock, or following the editor."
  [db [mode lock]]
  (case mode
    :locked (post db "repl-input-lock" :lock lock)
    :following (post db "repl-input-follow-editor")))

(defn- mode-fxs
  "Returns the effects that show the context line of `db`, and ask the extension for the `mode-change` that
   the history asks for, when there is one."
  [db mode-change]
  (cond-> (vec (render-fxs db))
    mode-change (conj (mode-fx db mode-change))))

(defn- show-history
  "Shows what walking or recalling the history `walked` to, and asks for the mode change it asks for, or
   does nothing when it went nowhere."
  [db walked]
  (if-let [{walked-db :db :keys [shown mode-change]} walked]
    {:uf/db walked-db
     :uf/fxs (into [[:repl-input/fx.apply-edit shown]]
                   (mode-fxs walked-db mode-change))}
    {:uf/db db}))

(defn- handle-history-action
  "Handles the actions of the history."
  [db [action-type payload :as action]]
  (case action-type
    :repl-input/ax.set-history
    (let [{with-history :db :keys [mode-change]} (history/with-entries db payload)]
      {:uf/db with-history
       :uf/fxs (mode-fxs with-history mode-change)})

    :repl-input/ax.walk-history
    (show-history db (history/walked db payload))

    :repl-input/ax.recall
    (show-history db (history/recalled db payload))

    (handle-completion-action db action)))

(defn- follow-editor
  "Asks the extension to follow the editor while locked. The shown history entry keeps the mode from then
   on."
  [db]
  (let [chosen (history/chosen db)]
    (if (get-in chosen [:repl-input/context-line :repl-input.context/locked?])
      {:uf/db chosen
       :uf/fxs [(post chosen "repl-input-follow-editor")]}
      {:uf/db chosen})))

(defn- click-namespace-indicator
  "Opens or closes the namespace menu while a recalled history entry locks the context, follows the editor
   while otherwise locked, and does nothing while following the editor. The shown history entry keeps the
   mode from then on."
  [db]
  (let [chosen (history/chosen db)]
    (if (history/recalled-lock chosen)
      {:uf/db chosen
       :uf/fxs [[:repl-input/fx.toggle-namespace-menu]]}
      (follow-editor chosen))))

(defn- evaluate
  "Asks the extension to evaluate the REPL Input while a session answers to the context."
  [db]
  (if (get-in db [:repl-input/context-line :repl-input.context/connected?])
    {:uf/db db
     :uf/fxs [(post db "repl-input-evaluate")]}
    {:uf/db db}))

(defn- handle-evaluation-action
  "Handles the actions of the context line, its namespace indicator and play button, the evaluation bar and
   the stdin input."
  [db [action-type payload :as action]]
  (case action-type
    :repl-input/ax.set-context-line
    (let [{with-line :db :keys [mode-change]} (history/with-context-line db payload)]
      {:uf/db with-line
       :uf/fxs (mode-fxs with-line mode-change)})

    :repl-input/ax.click-namespace-indicator
    (click-namespace-indicator db)

    :repl-input/ax.follow-editor
    (follow-editor db)

    :repl-input/ax.connect
    {:uf/db db
     :uf/fxs [(post db "repl-input-connect")]}

    :repl-input/ax.evaluate
    (evaluate db)

    :repl-input/ax.set-evaluation
    (let [evaluating (cond-> (assoc db :repl-input/evaluation payload)
                       (= :running payload) history/chosen)]
      {:uf/db evaluating
       :uf/fxs (evaluation-fxs (:repl-input/evaluation db) evaluating)})

    :repl-input/ax.namespace-menu-toggled
    (if (= (boolean payload) (boolean (:repl-input/namespace-menu-open? db)))
      {:uf/db db}
      (let [toggled (assoc db :repl-input/namespace-menu-open? (boolean payload))]
        {:uf/db toggled
         :uf/fxs (render-fxs toggled)}))

    :repl-input/ax.close-namespace-menu
    {:uf/db db
     :uf/fxs [[:repl-input/fx.close-namespace-menu]]}

    :repl-input/ax.focus
    {:uf/db db
     :uf/fxs [(if (reading-stdin? (:repl-input/evaluation db))
                [:repl-input/fx.focus-stdin]
                [:repl-input/fx.focus])]}

    :repl-input/ax.not-last-focused
    {:uf/db db
     :uf/fxs [[:repl-input/fx.forget-focus]]}

    :repl-input/ax.interrupt
    {:uf/db db
     :uf/fxs [(post db "repl-input-interrupt")]}

    :repl-input/ax.send-line
    {:uf/db db
     :uf/fxs [(post db "repl-input-send-line" :line payload)]}

    (handle-history-action db action)))

(defn handle-action
  [db [action-type payload :as action]]
  (case action-type
    :repl-input/ax.init
    (let [{:repl-input/keys [id enabled?]} payload]
      (set-enabled (assoc db :repl-input/id id) enabled?))

    :repl-input/ax.set-enabled
    (set-enabled db payload)

    :repl-input/ax.mounted
    {:uf/db (assoc db :repl-input/text (:text payload) :repl-input/selections (:selections payload))
     :uf/fxs [(post db "repl-input-mounted" :version (:repl-input/version db) :text (:text payload) :selections (:selections payload))]}

    :repl-input/ax.changed
    (let [version (inc (:repl-input/version db))]
      {:uf/db (assoc db :repl-input/version version :repl-input/text (:text payload) :repl-input/selections (:selections payload))
       :uf/fxs [(post db "repl-input-changed" :version version :text (:text payload) :selections (:selections payload))]})

    :repl-input/ax.edit
    (if (= (:repl-input/version payload) (:repl-input/version db))
      {:uf/db db
       :uf/fxs [[:repl-input/fx.apply-edit (select-keys payload [:text :selections :restore?])]]}
      {:uf/db db})

    :repl-input/ax.set-brackets
    (if (= (:repl-input/version payload) (:repl-input/version db))
      {:uf/db db
       :uf/fxs [[:repl-input/fx.set-brackets (brackets/mark-ranges (:repl-input/brackets payload))]]}
      {:uf/db db})

    :repl-input/ax.set-editor-settings
    (set-editor-settings db payload)

    :repl-input/ax.set-command-keys
    (let [command-keys (input-keys/command-keys payload)]
      {:uf/db (assoc db :repl-input/command-keys command-keys)
       :uf/fxs [[:repl-input/fx.set-command-keys command-keys]]})

    :repl-input/ax.run-command
    {:uf/db db
     :uf/fxs [[:repl-input/fx.run-command payload]]}

    :repl-input/ax.focused
    {:uf/db db
     :uf/fxs [(post db "repl-input-focused")]}

    :repl-input/ax.blurred
    {:uf/db db
     :uf/fxs [(post db "repl-input-blurred")]}

    (:repl-input/ax.drag-started :repl-input/ax.drag-ended)
    (let [dragged (assoc db :repl-input/dragging? (= :repl-input/ax.drag-started action-type))]
      {:uf/db dragged
       :uf/fxs (render-fxs dragged)})

    :repl-input/ax.drag
    (let [height (clamp-height payload)]
      {:uf/db (assoc db :repl-input/height height)
       :uf/fxs [[:repl-input/fx.set-height height]]})

    (handle-evaluation-action db action)))
