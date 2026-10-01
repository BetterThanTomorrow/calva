(ns calva.repl.webview.app-db
  (:require
   [calva.repl.webview.images :as images]))

(def initial-db
  {:output/last-context nil
   :output/base-font-scale 1.0
   :output/font-size-adjustment 0.0
   :output/render-images? true})

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

(defn output-text-and-images
  "Results and stdout get image data URLs swapped for placeholders, with the images returned
   separately, when image rendering is on. Other output is returned as is."
  [db command-name output]
  (if (and (:output/render-images? db)
           (string? output)
           (#{"show-result" "show-stdout"} command-name))
    (images/extract-images output)
    {:text output :images []}))

(defn handle-action
  [db [action-type payload]]
  (case action-type
    :msg/clear-output-view
    {:uf/db  (assoc db :output/last-context nil)
     :uf/fxs [[:fx/clear-dom]]}

    :msg/output
    (let [{:keys [command/name output meta output-category]} payload
          {:meta/keys [ns who repl-session-key shadow-build shadow-runtime-id]} meta
          ns (or ns (:ns meta))
          who (or who (:who meta))
          repl-session-key (or repl-session-key (:repl-session-key meta))
          shadow-build (or shadow-build (:shadow-build meta))
          shadow-runtime-id (or shadow-runtime-id (:shadow-runtime-id meta))
          context-key (when ns [who repl-session-key shadow-build shadow-runtime-id ns])
          context-changed? (and context-key (not= context-key (:output/last-context db)))
          {:keys [text images]} (output-text-and-images db name output)]
      {:uf/db  (cond-> db
                 context-changed? (assoc :output/last-context context-key))
       :uf/fxs (cond-> []
                 context-changed? (conj [:fx/append-ns-info meta])
                 (= name "show-result") (conj [:fx/append-result text])
                 (= name "show-evaluated-code") (conj [:fx/append-evaluated-code text])
                 (= name "show-stdout") (conj [:fx/append-stdout text (or output-category "evalOut")])
                 (seq images) (conj [:fx/append-images images]))})

    :msg/set-render-images
    {:uf/db (assoc db :output/render-images? (boolean (:render-images? payload)))}

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
