(ns calva.repl.input.semantic-tokens
  "Asks clojure-lsp for the semantic tokens of the REPL Inputs' text, a pause after it changes, in a copy
   below the followed file."
  (:require
   [calva.repl.input.completion :as completion]
   [calva.repl.input.highlighting :as highlighting]))

(def ^:private delay-ms 150)

(defonce ^{:private true
           :doc "Each REPL Input's pending request, what its last request was for, and the ranges it got."}
  !requests (atom {}))

(defn- request
  "Returns what the semantic tokens of the REPL Input `id` depend on in the host `state`, or nil before the
   grammar they go over is loaded, or when files get no semantic highlighting with `palette`."
  [state id palette]
  (when (and @highlighting/!grammar (:palette/semantic? palette))
    (let [^js document (get-in state [:repl-input.context/editor :document])]
      {:text (get-in state [:repl-input/records id :repl-input/text])
       :context (select-keys (:repl-input.context/line state) [:repl-input.context/ns-form
                                                               :repl-input.context/locked?])
       :document-version [(some-> document .-uri str) (some-> document .-version)]
       :palette palette})))

(defn- ranges+
  "Returns a promise of `[from to color]` in the request's text, from clojure-lsp's semantic tokens for a copy
   below `document`'s text, or of nil without clojure-lsp."
  [^js adapter {:keys [text context palette]} ^js document]
  (let [{copy-text :text :keys [text-line]} (completion/copy context (some-> document .getText) text 0)]
    (.then (.lspSemanticTokens adapter (some-> document .-uri) copy-text text-line)
           (fn [^js result]
             (when result
               (highlighting/semantic-ranges palette
                                             (highlighting/decode (js->clj (.-legend result) :keywordize-keys true)
                                                                  (vec (.-data result)))
                                             text-line
                                             text))))))

(defn- take-ranges!
  "Keeps the `ranges` the request `current` of the REPL Input `id` got, while it is still its last request,
   and calls `post!` with them. Forgets the request when it got none, so that the next one asks again."
  [id current post! ranges]
  (when (= current (get-in @!requests [id :requested]))
    (if ranges
      (do (swap! !requests assoc-in [id :ranges] ranges)
          (post! (:text current) ranges))
      (swap! !requests update id dissoc :requested))))

(defn request!
  "Asks clojure-lsp, through `adapter`, for the semantic tokens of the REPL Input `id` in the host `state`, and
   calls `post!` with the text and the ranges. When the last request was for the same text, context and file,
   calls `post!` with the ranges it got, without asking."
  [adapter state id post!]
  (let [current (request state id (highlighting/palette))
        {:keys [requested ranges]} (get @!requests id)]
    (cond
      (nil? current)
      (swap! !requests update id dissoc :requested :ranges)

      (not= current requested)
      (do (swap! !requests update id #(-> % (assoc :requested current) (dissoc :ranges)))
          (-> (ranges+ adapter current (get-in state [:repl-input.context/editor :document]))
              (.then #(take-ranges! id current post! %))
              (.catch (fn [e]
                        (js/console.error "Failed getting semantic tokens for the REPL Input:" e)
                        (take-ranges! id current post! nil)))))

      ranges
      (post! (:text current) ranges))))

(defn request-later!
  "Calls `request` after a pause, which the next call for the REPL Input `id` restarts."
  [id request]
  (some-> (get-in @!requests [id :timer]) js/clearTimeout)
  (swap! !requests assoc-in [id :timer] (js/setTimeout request delay-ms)))

(defn forget!
  "Forgets the pending and the last request of the REPL Input `id`, as when it mounts in a new page."
  [id]
  (some-> (get-in @!requests [id :timer]) js/clearTimeout)
  (swap! !requests dissoc id))
