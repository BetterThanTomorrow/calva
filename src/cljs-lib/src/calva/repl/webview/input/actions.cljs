(ns calva.repl.webview.input.actions
  "The REPL Input's actions in the Output view's page."
  (:require
   [calva.repl.webview.input.brackets :as brackets]
   [calva.repl.webview.input.keys :as input-keys]))

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
    {:uf/db (-> db (assoc :repl-input/enabled? false) (dissoc :repl-input/evaluation))
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

(defn- handle-definition-action
  "Handles the actions of go to definition and the evaluated code blocks it reveals."
  [db [action-type payload]]
  (case action-type
    :repl-input/ax.reveal-definition
    {:uf/db db
     :uf/fxs [(post db "repl-input-reveal-definition" :text (:text payload) :offset (:offset payload))]}

    :repl-input/ax.reveal-evaluation
    {:uf/db db
     :uf/fxs [[:fx/reveal-evaluated-code payload]]}

    :repl-input/ax.evaluation-revealed
    {:uf/db db
     :uf/fxs [(post db "repl-input-evaluation-revealed" :request (:request payload) :found? (:found? payload))]}

    {:uf/db db}))

(defn- handle-completion-action
  "Handles the actions of the completion list and its docs."
  [db [action-type payload :as action]]
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

    (handle-definition-action db action)))

(defn- reading-stdin?
  [evaluation]
  (= :reading-stdin evaluation))

(defn- stdin-effects
  "Shows the stdin input when the evaluation goes from `before` to reading stdin, and hides it when it
   stops reading."
  [before after]
  (cond
    (and (reading-stdin? after) (not (reading-stdin? before))) [[:repl-input/fx.show-stdin]]
    (and (reading-stdin? before) (not (reading-stdin? after))) [[:repl-input/fx.hide-stdin]]))

(defn- handle-evaluation-action
  "Handles the actions of the context line, the evaluation bar, the stdin input and the history."
  [db [action-type payload :as action]]
  (case action-type
    :repl-input/ax.set-context-line
    {:uf/db (assoc db :repl-input/context-line payload)
     :uf/fxs [[:repl-input/fx.set-context-line payload]]}

    :repl-input/ax.follow-editor
    (if (get-in db [:repl-input/context-line :repl-input.context/locked?])
      {:uf/db db
       :uf/fxs [(post db "repl-input-follow-editor")]}
      {:uf/db db})

    :repl-input/ax.set-evaluation
    {:uf/db (assoc db :repl-input/evaluation payload)
     :uf/fxs (into [[:repl-input/fx.set-evaluation payload]]
                   (stdin-effects (:repl-input/evaluation db) payload))}

    :repl-input/ax.focus
    {:uf/db db
     :uf/fxs [(if (reading-stdin? (:repl-input/evaluation db))
                [:repl-input/fx.focus-stdin]
                [:repl-input/fx.focus])]}

    :repl-input/ax.interrupt
    {:uf/db db
     :uf/fxs [(post db "repl-input-interrupt")]}

    :repl-input/ax.send-line
    {:uf/db db
     :uf/fxs [(post db "repl-input-send-line" :line payload)]}

    :repl-input/ax.walk-history
    {:uf/db db
     :uf/fxs [(post db "repl-input-walk-history" :direction (name payload))]}

    (handle-completion-action db action)))

(defn handle-action
  [db [action-type payload :as action]]
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

    :repl-input/ax.edit
    (if (= (:repl-input/version payload) (:repl-input/version db))
      {:uf/db db
       :uf/fxs [[:repl-input/fx.apply-edit (select-keys payload [:text :selections])]]}
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

    :repl-input/ax.drag
    (let [height (clamp-height (:height payload) (:view-height payload))]
      {:uf/db (assoc db :repl-input/height height)
       :uf/fxs [[:repl-input/fx.set-height {:height height :dragging? true}]]})

    :repl-input/ax.drag-ended
    {:uf/db db
     :uf/fxs [[:repl-input/fx.set-height {:height (:repl-input/height db) :dragging? false}]
              (post db "repl-input-resized" :height (:repl-input/height db))]}

    (handle-evaluation-action db action)))
