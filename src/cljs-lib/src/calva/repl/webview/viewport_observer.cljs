(ns calva.repl.webview.viewport-observer
  "While accessibility support is on, hides from screen readers the output blocks that are more than
   `editor.accessibilityPageSize` lines away from the visible part of the output. The blocks are observed from
   the element that scrolls: the output's own scroller while the REPL Input is below it, else the document.")

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

(defn root-margin
  "Returns the observer's margin of `lines` lines `line-height` pixels high, above and below the visible part."
  [lines line-height]
  (str (js/Math.round (* lines line-height)) "px 0px"))

(defn- line-height
  "Returns the height in pixels of a line of stdout in the page."
  []
  (let [probe (js/document.createElement "pre")]
    (.setAttribute probe "data-output-element-type" "stdout")
    (set! (.. probe -style -cssText) "position: absolute; visibility: hidden; margin: 0; padding: 0;")
    (set! (.-textContent probe) "x")
    (.append js/document.body probe)
    (let [height (.-offsetHeight probe)]
      (.remove probe)
      height)))

(defn page-root-margin
  "Returns the observer's margin of the page's `data-accessibility-page-size` lines, in its current font size."
  []
  (root-margin (js/Number (.. js/document -body (getAttribute "data-accessibility-page-size")))
               (line-height)))

(defn start!
  "Observes the blocks in `output-element`, and the blocks added to it, hiding the ones farther than `margin`,
   an IntersectionObserver root margin, from view. Starts again from the other root when the REPL Input comes
   or goes."
  [^js output-element margin]
  (disconnect!)
  (let [root (scroll-root)
        blocks (js/IntersectionObserver. #(run! set-aria-hidden! (aria-hidden-updates %))
                                         #js {:root root :rootMargin margin})
        children (js/MutationObserver.
                  (fn [records]
                    (doseq [^js record records]
                      (doseq [node (array-seq (.-addedNodes record)) :when (block? node)]
                        (observe-hidden! blocks node))
                      (doseq [node (array-seq (.-removedNodes record)) :when (block? node)]
                        (.unobserve blocks node)))))
        body (js/MutationObserver. #(when-not (identical? root (scroll-root))
                                      (start! output-element margin)))]
    (doseq [block (array-seq (.-children output-element))]
      (observe-hidden! blocks block))
    (.observe children output-element #js {:childList true})
    (.observe body js/document.body #js {:attributes true :attributeFilter #js ["class"]})
    (reset! !observers {:blocks blocks :children children :body body})))

(defn restart!
  "Starts the running observers again with the page's margin, as after a change of the font size."
  [^js output-element]
  (when @!observers
    (start! output-element (page-root-margin))))

(defn set-accessibility-support!
  "Shows screen readers the output in `output-element` near the visible part with `accessibility-support?`,
   within `accessibility-page-size` lines, and otherwise hides all of it from them and puts the
   `accessibility-note`, HTML, in the `note` element."
  [^js output-element ^js note {:keys [accessibility-support? accessibility-page-size accessibility-note]}]
  (.. js/document -body (setAttribute "data-accessibility-support" (if accessibility-support? "on" "off")))
  (.. js/document -body (setAttribute "data-accessibility-page-size" (str accessibility-page-size)))
  (if accessibility-support?
    (do (start! output-element (page-root-margin))
        (.removeAttribute output-element "aria-hidden"))
    (do (stop! output-element)
        (.setAttribute output-element "aria-hidden" "true")))
  (when note
    (set! (.-innerHTML note) (if accessibility-support? "" (or accessibility-note "")))))
