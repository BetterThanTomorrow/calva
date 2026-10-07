(ns calva.repl.webview.app-db
  (:require
   [calva.repl.webview.images :as images]))

(def initial-db
  {:output/last-context nil
   :output/base-font-scale 1.0
   :output/font-size-adjustment 0.0
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
   separately. Other output is returned as is."
  [command-name output]
  (if (and (string? output)
           (#{"show-result" "show-stdout"} command-name))
    (images/extract-images output)
    {:text output :images []}))

(defn- raw-display?
  "True when the output webview body is in raw image-display mode."
  []
  (boolean
   (and (exists? js/document)
        (.-body js/document)
        (= "raw" (.getAttribute (.-body js/document) "data-image-display")))))

(defn- continues-pending?
  [db command-name category]
  (and (= "show-stdout" command-name)
       (= category (get-in db [:output/pending-stdout :category]))))

(defn- split-pending-stdout
  "Joins pending stdout of the same `category` with `output`, then splits off a tail that may
   continue in the next chunk: nREPL sends stdout in chunks of about 1 kB, which cuts long image
   data URLs. Returns `{:shown text :pending {:text :category}}`, `:pending` nil when nothing is
   held back. In raw mode nothing is held back: every chunk is shown as printed."
  [db output category]
  (let [joined (if (continues-pending? db "show-stdout" category)
                 (str (get-in db [:output/pending-stdout :text]) output)
                 output)]
    (if (raw-display?)
      {:shown joined
       :pending nil}
      (let [start (when (string? joined)
                    (images/pending-start joined))]
        (if start
          {:shown (subs joined 0 start)
           :pending {:text (subs joined start) :category category}}
          {:shown joined
           :pending nil})))))

(defn- stdout-fxs
  "Stdout with images is appended as both forms: `:text` with placeholders plus `:images`, and the
   original text as `:raw`. In raw mode every line is appended as plain text, as printed."
  [output category]
  (if (raw-display?)
    (if (seq output)
      [[:fx/append-stdout output category]]
      [])
    (let [{:keys [text images] :as extracted} (output-text-and-images "show-stdout" output)]
      (cond
        (seq images) [[:fx/append-stdout-with-images (assoc extracted :raw output) category]]
        (seq text) [[:fx/append-stdout text category]]
        :else []))))

(defn- result-fxs
  "A result with images is appended as both forms, like stdout. In raw mode the result is appended
   as plain text, as printed."
  [output]
  (if (raw-display?)
    [[:fx/append-result output]]
    (let [{:keys [images] :as extracted} (output-text-and-images "show-result" output)]
      (if (seq images)
        [[:fx/append-result-with-images (assoc extracted :raw output)]]
        [[:fx/append-result output]]))))

(defn- message-update
  "The pending stdout and the append fxs for one output message."
  [db command-name output category]
  (case command-name
    "show-stdout" (let [{:keys [shown pending]} (split-pending-stdout db output category)]
                    {:pending pending
                     :fxs (stdout-fxs shown category)})
    "show-result" {:pending nil
                   :fxs (result-fxs output)}
    "show-evaluated-code" {:pending nil
                           :fxs [[:fx/append-evaluated-code output]]}
    {:pending nil
     :fxs []}))

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
  "Pending stdout that this message does not continue is appended first. When the REPL context
   changes, pending stdout is flushed as it is, and this message is handled with no pending stdout."
  [db {:keys [command/name output meta output-category]}]
  (let [context-key (meta-context-key meta)
        context-changed? (and context-key (not= context-key (:output/last-context db)))
        category (or output-category "evalOut")
        db-for-update (cond-> db
                        context-changed? (assoc :output/pending-stdout nil))
        flushed (when-not (continues-pending? db-for-update name category)
                  (:output/pending-stdout db))
        {:keys [pending fxs]} (message-update db-for-update name output category)]
    {:uf/db  (cond-> (assoc db :output/pending-stdout pending)
               context-changed? (assoc :output/last-context context-key))
     :uf/fxs (cond-> []
               flushed (into (stdout-fxs (:text flushed) (:category flushed)))
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
