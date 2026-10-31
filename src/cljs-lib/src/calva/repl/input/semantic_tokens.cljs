(ns calva.repl.input.semantic-tokens
  "Asks clojure-lsp for the semantic tokens of the REPL Inputs' text, a pause after it changes, in a copy
   below the followed file."
  (:require
   [calva.repl.input.completion :as completion]
   [calva.repl.input.highlighting :as highlighting]
   [clojure.string :as string]))

(def ^:private delay-ms 150)

(defonce ^{:private true
           :doc "Each REPL Input's pending request, what its last request was for, and the ranges it got."}
  !requests (atom {}))

(defn- request
  "Returns what the semantic tokens of the REPL Input `id` depend on in the host `state`: its text, the context,
   the followed file, and that file's version when the copy holds its text. Nil for blank text, before the
   grammar they go over is loaded, or when files get no semantic highlighting with `palette`."
  [state id palette]
  (let [text (get-in state [:repl-input/records id :repl-input/text])
        {:repl-input.context/keys [locked?] :as context} (select-keys (:repl-input.context/line state)
                                                                       [:repl-input.context/ns-form
                                                                        :repl-input.context/locked?
                                                                        :repl-input.context/source-file
                                                                        :repl-input.context/session-key])
        ^js document (get-in state [:repl-input.context/editor :document])]
    (when (and @highlighting/!grammar (:palette/semantic? palette) (not (string/blank? text)))
      {:text text
       :context context
       :document-version [(some-> document .-uri str) (when-not locked? (some-> document .-version))]
       :palette palette})))

(defn- ranges+
  "Asks for clojure-lsp's semantic tokens for a copy below `document`'s text. Returns `{:ranges+ :cancel}`: a
   promise of `[from to color font-styles]` in the request's text, or of nil without clojure-lsp or when
   cancelled, and the function that cancels the request."
  [^js adapter {:keys [text context palette]} ^js document]
  (let [{copy-text :text :keys [extension text-line]} (completion/copy context (some-> document .getText) text 0)
        ^js answer (.lspSemanticTokens adapter (some-> document .-uri) #js {:text copy-text :extension extension} text-line)]
    {:cancel (.-cancel answer)
     :ranges+ (.then (.-tokens answer)
                     (fn [^js result]
                       (when result
                         (highlighting/semantic-ranges palette
                                                       (highlighting/decode (js->clj (.-legend result) :keywordize-keys true)
                                                                            (vec (.-data result)))
                                                       text-line
                                                       text))))}))

(defn- take-ranges!
  "Keeps the `ranges` the request `current` of the REPL Input `id` got, while it is still its last request,
   and calls `post!` with them. Forgets the request when it got none, so that the next one asks again. An equal
   request made later is another request, since a cancelled one gets none."
  [id current post! ranges]
  (when (identical? current (get-in @!requests [id :requested]))
    (if ranges
      (do (swap! !requests assoc-in [id :ranges] ranges)
          (post! (:text current) ranges))
      (swap! !requests update id dissoc :requested))))

(defn- cancel!
  "Cancels the last request of the REPL Input `id`. A request that clojure-lsp has answered stays as it is."
  [id]
  (some-> (get-in @!requests [id :cancel]) (apply [])))

(defn request!
  "Asks clojure-lsp, through `adapter`, for the semantic tokens of the REPL Input `id` in the host `state`, and
   calls `post!` with the text and the ranges. Cancels the last request when it was for another text, context
   or file. When it was for the same, calls `post!` with the ranges it got, without asking."
  [adapter state id post!]
  (let [current (request state id (highlighting/palette))
        {:keys [requested ranges]} (get @!requests id)]
    (cond
      (nil? current)
      (do (cancel! id)
          (swap! !requests update id dissoc :requested :ranges :cancel))

      (not= current requested)
      (do (cancel! id)
          (let [{:keys [cancel] :as answer} (ranges+ adapter current (get-in state [:repl-input.context/editor :document]))]
            (swap! !requests update id #(-> % (assoc :requested current :cancel cancel) (dissoc :ranges)))
            (-> (:ranges+ answer)
                (.then #(take-ranges! id current post! %))
                (.catch (fn [e]
                          (js/console.error "Failed getting semantic tokens for the REPL Input:" e))))))

      ranges
      (post! (:text current) ranges))))

(defn request-later!
  "Calls `request` after a pause, which the next call for the REPL Input `id` restarts."
  [id request]
  (some-> (get-in @!requests [id :timer]) js/clearTimeout)
  (swap! !requests assoc-in [id :timer] (js/setTimeout request delay-ms)))

(defn forget!
  "Forgets the pending and the last request of the REPL Input `id`, and cancels the last, as when it mounts in a
   new page."
  [id]
  (some-> (get-in @!requests [id :timer]) js/clearTimeout)
  (cancel! id)
  (swap! !requests dissoc id))
