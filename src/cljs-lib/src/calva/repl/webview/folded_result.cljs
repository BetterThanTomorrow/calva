(ns calva.repl.webview.folded-result
  "Large evaluation results, shown folded: their one-line block, the text the page keeps for them, and
   unfolding them. The page's drawing functions come in as arguments, since `ui` requires this namespace."
  (:require
   [calva.repl.webview.copy-button :as copy-button]
   [calva.repl.webview.error-element :as error-element]
   [calva.repl.webview.folding :as folding]
   [calva.repl.webview.tooltip :as tooltip]))

(defonce ^{:private true
           :doc "The text of each folded result, with the namespace and session of the output it was printed
                 in, `{:folded/text :folded/ns :folded/session-key}` by its id."}
  !folded
  (atom {}))

(defonce ^:private !last-id (atom 0))

(defonce ^{:private true :doc "The block of the result unfolded last, which the output cap keeps."}
  !just-unfolded
  (atom nil))

(defn just-unfolded
  "Returns the block of the result unfolded last, or nil."
  []
  @!just-unfolded)

(defn forget!
  "Drops the text kept for the folded results with `ids`."
  [ids]
  (swap! !folded #(apply dissoc % ids)))

(defn clear!
  "Drops all folded results' text, and the block unfolded last."
  []
  (reset! !folded {})
  (reset! !just-unfolded nil))

(defn element
  "Returns the hiccup of the folded result `text` with `id`: its Unfold result button, the start of its first
   line, its size, and its Copy button."
  [id text]
  [:pre {:class ["output-code-block" "output-folded-result"]
         :data-output-element-type "folded-result"
         :data-folded-id id}
   [:button (merge {:type "button"
                    :class ["output-unfold"]
                    :aria-label "Unfold result"
                    :data-action (pr-str [[:output/ax.unfold-result :event/target]])}
                   (tooltip/attributes "Unfold result"))
    [:svg {:class ["output-folded-chevron"] :viewBox "0 0 16 16" :aria-hidden "true"}
     [:path {:d error-element/chevron-path}]]]
   [:span {:class ["output-folded-start"]} (folding/start text)]
   [:span {:class ["output-folded-size"]} (apply folding/size-text (folding/text-size text))]
   [copy-button/button {:class ["output-code-copy"]
                        :copy/label "Copy"
                        :copy/actions [[:output/ax.copy-folded-result :event/target]]}]])

(defn- kept
  "Returns what is kept for the folded result that `element` is in."
  [^js element]
  (some-> (.closest element "[data-folded-id]") (.getAttribute "data-folded-id") (->> (get @!folded))))

(defn text
  "Returns the whole text of the folded result that `element` is in."
  [^js element]
  (:folded/text (kept element)))

(defn append!
  "Appends `result` folded to `dom-element` with `insert!`, keeping its text with the namespace and session of
   `context`, and returns its block."
  [^js dom-element result insert! {:keys [ns session-key]}]
  (let [id (str (swap! !last-id inc))]
    (swap! !folded assoc id {:folded/text result :folded/ns ns :folded/session-key session-key})
    (insert! dom-element "beforeend" (element id result))))

(defn unfold!
  "Draws the folded result of the Unfold result `button` whole in its place with `insert!` and `code-element`,
   gives its code the namespace and session it was printed in, colors it with `request-colors!`, and keeps it
   from the output cap until another result is unfolded. Returns the new block."
  [^js button {:keys [insert! code-element request-colors!]}]
  (let [^js block (.closest button "[data-folded-id]")]
    (when-let [{:folded/keys [text ns session-key]} (kept button)]
      (let [^js unfolded (insert! block "afterend" (code-element text))
            focused? (.contains block js/document.activeElement)]
        (swap! !folded dissoc (.getAttribute block "data-folded-id"))
        (.remove block)
        (doseq [^js code (array-seq (.querySelectorAll unfolded "code.clojure-code"))]
          (some->> ns (set! (.. code -dataset -ns)))
          (some->> session-key (set! (.. code -dataset -sessionKey))))
        (reset! !just-unfolded unfolded)
        (request-colors! unfolded)
        (when focused?
          (some-> (.querySelector unfolded "button") .focus))
        unfolded))))
