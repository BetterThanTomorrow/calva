(ns calva.repl.webview.app-db)

(def initial-db
  {:output/last-context nil})

(defonce !app-db (atom initial-db))

(defn handle-action
  [db [action-type payload]]
  (case action-type
    :msg/clear-output-view
    {:uf/db  (assoc db :output/last-context nil)
     :uf/fxs [[:fx/clear-dom]]}

    :msg/output
    (let [{:keys [command/name output meta]} payload
          {:meta/keys [ns who repl-session-key shadow-build shadow-runtime-id]} meta
          ns (or ns (:ns meta))
          who (or who (:who meta))
          repl-session-key (or repl-session-key (:repl-session-key meta))
          shadow-build (or shadow-build (:shadow-build meta))
          shadow-runtime-id (or shadow-runtime-id (:shadow-runtime-id meta))
          context-key (when ns [who repl-session-key shadow-build shadow-runtime-id ns])
          context-changed? (and context-key (not= context-key (:output/last-context db)))]
      {:uf/db  (cond-> db
                 context-changed? (assoc :output/last-context context-key))
       :uf/fxs (cond-> []
                 context-changed? (conj [:fx/append-ns-info meta])
                 (= name "show-result") (conj [:fx/append-result output])
                 (= name "show-evaluated-code") (conj [:fx/append-evaluated-code output])
                 (= name "show-stdout") (conj [:fx/append-stdout output]))})

    :msg/set-code-theme
    {:uf/db db
     :uf/fxs [[:fx/set-code-theme (:code-theme payload)]]}

    :msg/set-word-wrap
    {:uf/db db
     :uf/fxs [[:fx/set-word-wrap (:word-wrap payload)]]}

    :msg/scroll-to
    {:uf/db db
     :uf/fxs [[:fx/scroll-to payload]]}

    {:uf/db db}))
