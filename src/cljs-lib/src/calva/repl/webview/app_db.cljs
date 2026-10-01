(ns calva.repl.webview.app-db
  (:require
   [calva.repl.webview.images :as images]))

(def initial-db
  {:output/last-context nil
   :output/base-font-scale 1.0
   :output/font-size-adjustment 0.0
   :output/render-images? true
   :output/pending-stdout nil})

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

(defn- continues-pending?
  [db command-name category]
  (and (= "show-stdout" command-name)
       (= category (get-in db [:output/pending-stdout :category]))))

(defn- split-pending-stdout
  "Joins pending stdout of the same `category` with `output`, then splits off a tail that may
   continue in the next chunk: nREPL sends stdout in chunks of about 1 kB, which cuts long image
   data URLs. Returns `{:shown text :pending {:text :category}}`, `:pending` nil when nothing is
   held back."
  [db output category]
  (let [joined (if (continues-pending? db "show-stdout" category)
                 (str (get-in db [:output/pending-stdout :text]) output)
                 output)
        start (when (and (:output/render-images? db) (string? joined))
                (images/pending-start joined))]
    (if start
      {:shown (subs joined 0 start)
       :pending {:text (subs joined start) :category category}}
      {:shown joined
       :pending nil})))

(defn- stdout-fxs
  [db output category]
  (let [{:keys [text images]} (output-text-and-images db "show-stdout" output)]
    (cond-> []
      (seq text) (conj [:fx/append-stdout text category])
      (seq images) (conj [:fx/append-images images]))))

(defn- message-update
  "The pending stdout and the append fxs for one output message."
  [db command-name output category]
  (if (= "show-stdout" command-name)
    (let [{:keys [shown pending]} (split-pending-stdout db output category)]
      {:pending pending
       :fxs (stdout-fxs db shown category)})
    (let [{:keys [text images]} (output-text-and-images db command-name output)]
      {:pending nil
       :fxs (cond-> []
              (= command-name "show-result") (conj [:fx/append-result text])
              (= command-name "show-evaluated-code") (conj [:fx/append-evaluated-code text])
              (seq images) (conj [:fx/append-images images]))})))

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
  "Pending stdout that this message does not continue is appended first."
  [db {:keys [command/name output meta output-category]}]
  (let [context-key (meta-context-key meta)
        context-changed? (and context-key (not= context-key (:output/last-context db)))
        category (or output-category "evalOut")
        flushed (when-not (continues-pending? db name category)
                  (:output/pending-stdout db))
        {:keys [pending fxs]} (message-update db name output category)]
    {:uf/db  (cond-> (assoc db :output/pending-stdout pending)
               context-changed? (assoc :output/last-context context-key))
     :uf/fxs (cond-> []
               flushed (into (stdout-fxs db (:text flushed) (:category flushed)))
               context-changed? (conj [:fx/append-ns-info meta])
               :always (into fxs))}))

(defn handle-action
  [db [action-type payload]]
  (case action-type
    :msg/clear-output-view
    {:uf/db  (assoc db :output/last-context nil :output/pending-stdout nil)
     :uf/fxs [[:fx/clear-dom]]}

    :msg/output
    (handle-output db payload)

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
