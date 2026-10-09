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
   separately. Evaluation results also match every printed string that is a whole image URL or
   image file path; stdout and stderr match whole lines. Other output is returned as is."
  [command-name output]
  (if (and (string? output)
           (#{"show-result" "show-stdout"} command-name))
    (images/extract-images output (if (= "show-result" command-name)
                                    {:refs :result}
                                    {:refs :whole-line}))
    {:text output :images []}))

(defn- continues-pending?
  [db command-name category]
  (and (= "show-stdout" command-name)
       (= category (get-in db [:output/pending-stdout :category]))))

(defn- split-pending-stdout
  "Joins pending stdout of the same `category` with `output`, then splits off a tail that may
   continue in the next chunk: nREPL sends stdout in chunks of about 1 kB, which cuts long image
   data URLs. Returns `{:shown :pending :raw}`; `:raw` is text to append without image extraction
   when an open pending payload exceeded `images/max-pending-stdout-chars`."
  [db output category]
  (if (continues-pending? db "show-stdout" category)
    (images/continue-pending-stdout (:output/pending-stdout db) output)
    (images/take-pending-stdout output category)))

(defn- pending-stdout-text
  "Full stdout text held in `pending`, including any same-line `:prefix`."
  [pending]
  (str (:prefix pending) (:text pending)))

(defn- stdout-fxs
  "Stdout with images is appended as both forms: `:text` with placeholders plus `:images`, and the
   original text as `:raw`."
  [output category]
  (let [{:keys [text images] :as extracted} (output-text-and-images "show-stdout" output)]
    (cond
      (seq images) [[:fx/append-stdout-with-images (assoc extracted :raw output) category]]
      (seq text) [[:fx/append-stdout text category]]
      :else [])))

(defn- result-fxs
  "A result with images is appended as both forms, like stdout."
  [output]
  (let [{:keys [images] :as extracted} (output-text-and-images "show-result" output)]
    (if (seq images)
      [[:fx/append-result-with-images (assoc extracted :raw output)]]
      [[:fx/append-result output]])))

(defn- message-update
  "The pending stdout and the append fxs for one output message."
  [db command-name output category]
  (case command-name
    "show-stdout" (let [{:keys [shown pending raw]} (split-pending-stdout db output category)]
                    {:pending pending
                     :fxs (cond-> []
                            (seq raw) (conj [:fx/append-stdout raw category])
                            (seq shown) (into (stdout-fxs shown category)))})
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
               flushed (into (stdout-fxs (pending-stdout-text flushed) (:category flushed)))
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

    :msg/flush-pending-stdout
    (if-let [pending (:output/pending-stdout db)]
      (if (:payload-start pending)
        {:uf/db db}
        {:uf/db (assoc db :output/pending-stdout nil)
         :uf/fxs (stdout-fxs (pending-stdout-text pending) (:category pending))})
      {:uf/db db})

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
