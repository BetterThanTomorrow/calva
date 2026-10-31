(ns calva.repl.input.semantic-tokens
  "Asks clojure-lsp for the semantic tokens of the REPL Inputs' text, a pause after it changes, in a copy
   below the followed file."
  (:require
   [calva.repl.input.completion :as completion]
   [calva.repl.input.highlighting :as highlighting]))

(def ^:private delay-ms 150)

(defonce ^{:private true
           :doc "Each REPL Input's pending request, and what its last request was for."}
  !requests (atom {}))

(defn- request
  "Returns what the semantic tokens of the REPL Input `id` depend on in the host `state`, or nil when files get
   no semantic highlighting with `palette`."
  [state id palette]
  (when (:palette/semantic? palette)
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

(defn request!
  "Asks clojure-lsp, through `adapter`, for the semantic tokens of the REPL Input `id` in the host `state`, unless
   its last request was for the same text, context and file, and calls `post!` with the text and the ranges.
   Calls `post!` with no ranges when files got no semantic highlighting since the last request."
  [adapter state id post!]
  (let [current (request state id (highlighting/palette))
        requested (get-in @!requests [id :requested])]
    (cond
      (and (nil? current) requested)
      (do (swap! !requests update id dissoc :requested)
          (post! (get-in state [:repl-input/records id :repl-input/text]) []))

      (and current (not= current requested))
      (do (swap! !requests assoc-in [id :requested] current)
          (-> (ranges+ adapter current (get-in state [:repl-input.context/editor :document]))
              (.then #(some->> % (post! (:text current))))
              (.catch (fn [e]
                        (js/console.error "Failed getting semantic tokens for the REPL Input:" e))))))))

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
