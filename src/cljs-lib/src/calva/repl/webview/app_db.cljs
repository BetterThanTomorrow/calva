(ns calva.repl.webview.app-db
  (:require
   [calva.repl.webview.images :as images]
   [calva.repl.webview.stacktrace :as stacktrace]))

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
  "A result with images, or with data URLs replaced by markers, is appended as both forms:
   `:text` for the image form and the original text as `:raw`. `meta` is kept so relative
   local paths resolve against the producing session's root."
  [output meta]
  (let [{:keys [text images] :as extracted} (if (string? output)
                                               (images/extract-images output)
                                               {:text output :images []})]
    (if (or (seq images)
            (not= text output))
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

(defn- with-context
  "Returns `db` with the context of `meta`, and the effects that show the context when it changed."
  [db meta]
  (let [context-key (meta-context-key meta)]
    (if (and context-key (not= context-key (:output/last-context db)))
      [(assoc db :output/last-context context-key) [[:fx/append-ns-info meta]]]
      [db []])))

(defn- handle-output
  [db {:keys [command/name output meta output-category]}]
  (let [[db context-fxs] (with-context db meta)
        category (or output-category "evalOut")]
    {:uf/db db
     :uf/fxs (into context-fxs (message-fxs name output category meta))}))

(defn- handle-error
  [db {:keys [meta] :as message}]
  (let [[db context-fxs] (with-context db meta)
        {:error/keys [id] :as error} (stacktrace/error-entry message)]
    {:uf/db (assoc-in db [:output/errors id] error)
     :uf/fxs (conj context-fxs [:fx/render-error error])}))

(defn- update-error
  [db id f & args]
  (if-let [error (get-in db [:output/errors id])]
    (let [error (apply f error args)]
      {:uf/db (assoc-in db [:output/errors id] error)
       :uf/fxs [[:fx/render-error error]]})
    {:uf/db db}))

(defn- handle-error-action
  [db action-type payload]
  (case action-type
    :error/ax.toggle
    (update-error db payload stacktrace/toggle-unfolded)

    :error/ax.toggle-cause
    (let [{:error/keys [id] :cause/keys [index]} payload]
      (update-error db id stacktrace/toggle-cause index))

    :error/ax.toggle-flag
    (let [{:error/keys [id] :frame/keys [flag]} payload]
      (update-error db id stacktrace/toggle-flag flag))

    :error/ax.set-frame-filter
    (let [{:error/keys [id frame-filter]} payload]
      (update-error db id assoc :error/frame-filter frame-filter))

    :error/ax.open-frame
    (let [{:frame/keys [file-url line column]} payload]
      {:uf/db db
       :uf/fxs [[:fx/post-to-host {:command "open-frame" :fileUrl file-url :line line :column column}]]})

    :error/ax.copy
    (let [{:error/keys [id]} payload]
      {:uf/db db
       :uf/fxs [[:fx/copy-error-text {:error/id id
                                      :copy/text (stacktrace/filtered-text (get-in db [:output/errors id]))}]]})

    :error/ax.open-java-frame
    (let [{:frame/keys [qualifier line] member :frame/name :error/keys [session-key]} payload]
      {:uf/db db
       :uf/fxs [[:fx/post-to-host {:command "open-java-frame"
                                   :className qualifier
                                   :member member
                                   :line line
                                   :sessionKey session-key}]]})))

(defn handle-action
  [db [action-type payload]]
  (case action-type
    :msg/clear-output-view
    {:uf/db  (-> db
                 (assoc :output/last-context nil)
                 (dissoc :output/errors))
     :uf/fxs [[:fx/clear-dom]]}

    :msg/output
    (handle-output db payload)

    :msg/error
    (handle-error db payload)

    :msg/error-causes
    (update-error db (:error/id payload) stacktrace/with-causes (:error/causes payload))

    (:error/ax.toggle :error/ax.toggle-cause :error/ax.toggle-flag :error/ax.set-frame-filter
     :error/ax.open-frame :error/ax.open-java-frame :error/ax.copy)
    (handle-error-action db action-type payload)

    :msg/set-image-display
    {:uf/db db
     :uf/fxs [[:fx/set-image-display (:image-display payload)]]}

    :msg/set-code-theme
    {:uf/db db
     :uf/fxs [[:fx/set-code-theme (:code-theme payload)]
              [:fx/set-token-colors (:token-colors payload)]]}

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
