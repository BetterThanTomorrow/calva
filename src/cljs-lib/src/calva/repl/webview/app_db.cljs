(ns calva.repl.webview.app-db
  (:require
   [calva.repl.webview.images :as images]))

(def initial-db
  {:output/last-context nil
   :output/base-font-scale 1.0
   :output/font-size-adjustment 0.0})

(defonce !app-db (atom initial-db))

(defn compute-effective-scale
  [{:output/keys [base-font-scale font-size-adjustment]}]
  (let [base (or base-font-scale 1.0)
        adj (or font-size-adjustment 0.0)
        scale (+ base adj)]
    (-> (max 0.5 (min 1.5 scale))
        (* 100)
        js/Math.round
        (/ 100))))

(defn- result-fxs
  "A result with images is appended as both forms: `:text` with placeholders plus `:images`, and
   the original text as `:raw`. `meta` is kept so relative local paths resolve against the
   producing session's root."
  [output meta]
  (let [{:keys [images] :as extracted} (if (string? output)
                                         (images/extract-images output)
                                         {:text output :images []})]
    (if (seq images)
      [[:fx/append-result-with-images (cond-> (assoc extracted :raw output)
                                         meta (assoc :meta meta))]]
      [[:fx/append-result output]])))

(defn- message-fxs
  [command-name output category meta]
  (case command-name
    "show-stdout" (if (seq output)
                    [[:fx/append-stdout output category]]
                    [])
    "show-result" (result-fxs output meta)
    "show-evaluated-code" [[:fx/append-evaluated-code output]]
    []))

(defn- meta-context-key
  [meta]
  (let [{:meta/keys [ns who repl-session-key shadow-build shadow-runtime-id]} meta
        ns (or ns (:ns meta))
        who (or who (:who meta))
        repl-session-key (or repl-session-key (:repl-session-key meta))
        shadow-build (or shadow-build (:shadow-build meta))
        shadow-runtime-id (or shadow-runtime-id (:shadow-runtime-id meta))]
    (when ns [who repl-session-key shadow-build shadow-runtime-id ns])))

(defn- handle-output
  [db {:keys [command/name output meta output-category]}]
  (let [context-key (meta-context-key meta)
        context-changed? (and context-key (not= context-key (:output/last-context db)))
        category (or output-category "evalOut")
        fxs (message-fxs name output category meta)]
    {:uf/db (cond-> db
              context-changed? (assoc :output/last-context context-key))
     :uf/fxs (cond-> []
               context-changed? (conj [:fx/append-ns-info meta])
               :always (into fxs))}))

(defn handle-action
  [db [action-type payload]]
  (case action-type
    :msg/clear-output-view
    {:uf/db  (assoc db :output/last-context nil)
     :uf/fxs [[:fx/clear-dom]]}

    :msg/output
    (handle-output db payload)

    :msg/set-image-display
    {:uf/db db
     :uf/fxs [[:fx/set-image-display (:image-display payload)]]}

    :msg/set-code-theme
    {:uf/db db
     :uf/fxs [[:fx/set-code-theme (:code-theme payload)]]}

    :msg/set-word-wrap
    {:uf/db db
     :uf/fxs [[:fx/set-word-wrap (:word-wrap payload)]]}

    :msg/set-base-font-scale
    (let [new-db (assoc db :output/base-font-scale (:scale payload 1.0))
          effective-scale (compute-effective-scale new-db)]
      {:uf/db new-db
       :uf/fxs [[:fx/set-font-scale effective-scale]]})

    :msg/adjust-font-size
    (let [delta (:delta payload 0.1)
          current-adj (or (:output/font-size-adjustment db) 0.0)
          new-adj (+ current-adj delta)
          new-db (assoc db :output/font-size-adjustment new-adj)
          effective-scale (compute-effective-scale new-db)]
      {:uf/db new-db
       :uf/fxs [[:fx/set-font-scale effective-scale]]})

    :msg/reset-font-size
    (let [new-db (assoc db :output/font-size-adjustment 0.0)
          effective-scale (compute-effective-scale new-db)]
      {:uf/db new-db
       :uf/fxs [[:fx/set-font-scale effective-scale]]})

    :msg/scroll-to
    {:uf/db db
     :uf/fxs [[:fx/scroll-to payload]]}

    {:uf/db db}))
