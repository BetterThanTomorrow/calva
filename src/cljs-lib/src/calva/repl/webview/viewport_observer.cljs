(ns calva.repl.webview.viewport-observer
  "While accessibility support is on, hides from screen readers the output blocks that are more than a scroll
   height away from the visible part of the output. The blocks are observed from the element that scrolls:
   the output's own scroller while the REPL Input is below it, else the document.")

(def ^:private root-margin "100% 0px")

(defonce ^{:private true
           :doc "The running observers of the output blocks, the output's children and the body's class."}
  !observers
  (atom nil))

(defn observers
  "Returns the running observers, `:blocks`, `:children` and `:body`, or nil."
  []
  @!observers)

(defn aria-hidden-updates
  "Returns `[block hidden?]` for each of the IntersectionObserver `entries`: hidden out of the observed range."
  [entries]
  (mapv (fn [^js entry] [(.-target entry) (not (.-isIntersecting entry))]) entries))

(defn- set-aria-hidden!
  "Hides `block` from screen readers, unless it holds the focus, or makes it readable."
  [[^js block hidden?]]
  (if hidden?
    (when-not (some->> js/document.activeElement (.contains block))
      (.setAttribute block "aria-hidden" "true"))
    (.removeAttribute block "aria-hidden")))

(defn- scroll-root
  "Returns the element the output scrolls in."
  []
  (if (.. js/document -body -classList (contains "repl-input-on"))
    (js/document.getElementById "output-scroller")
    js/document))

(defn- block?
  [^js node]
  (some? (.-tagName node)))

(defn- disconnect!
  []
  (when-let [{:keys [^js blocks ^js children ^js body]} @!observers]
    (.disconnect blocks)
    (.disconnect children)
    (.disconnect body)
    (reset! !observers nil)))

(defn stop!
  "Stops observing, and makes every block in `output-element` readable again."
  [^js output-element]
  (disconnect!)
  (doseq [^js block (array-seq (.-children output-element))]
    (.removeAttribute block "aria-hidden")))

(defn- observe-hidden!
  "Hides `block` and observes it with `blocks`, which shows it when it is near the view."
  [^js blocks block]
  (set-aria-hidden! [block true])
  (.observe blocks block))

(defn start!
  "Observes the blocks in `output-element`, and the blocks added to it, hiding the ones far from view. Starts
   again from the other root when the REPL Input comes or goes."
  [^js output-element]
  (disconnect!)
  (let [root (scroll-root)
        blocks (js/IntersectionObserver. #(run! set-aria-hidden! (aria-hidden-updates %))
                                         #js {:root root :rootMargin root-margin})
        children (js/MutationObserver.
                  (fn [records]
                    (doseq [^js record records]
                      (doseq [node (array-seq (.-addedNodes record)) :when (block? node)]
                        (observe-hidden! blocks node))
                      (doseq [node (array-seq (.-removedNodes record)) :when (block? node)]
                        (.unobserve blocks node)))))
        body (js/MutationObserver. #(when-not (identical? root (scroll-root))
                                      (start! output-element)))]
    (doseq [block (array-seq (.-children output-element))]
      (observe-hidden! blocks block))
    (.observe children output-element #js {:childList true})
    (.observe body js/document.body #js {:attributes true :attributeFilter #js ["class"]})
    (reset! !observers {:blocks blocks :children children :body body})))

(defn set-accessibility-support!
  "Shows screen readers the output in `output-element` near the visible part with `accessibility-support?`,
   and otherwise hides all of it from them and puts `accessibility-note` in the `note` element."
  [^js output-element ^js note {:keys [accessibility-support? accessibility-note]}]
  (.. js/document -body (setAttribute "data-accessibility-support" (if accessibility-support? "on" "off")))
  (if accessibility-support?
    (do (start! output-element)
        (.removeAttribute output-element "aria-hidden"))
    (do (stop! output-element)
        (.setAttribute output-element "aria-hidden" "true")))
  (when note
    (set! (.-textContent note) (if accessibility-support? "" accessibility-note))))
