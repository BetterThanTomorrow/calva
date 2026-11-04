(ns calva.repl.webview.viewport-observer
  "Observes which output blocks are within `editor.accessibilityPageSize` lines of the visible part of the
   output. The code in the blocks near it is colored, and while accessibility support is on, the blocks
   farther away are hidden from screen readers. The blocks are observed from the element that scrolls: the
   output's own scroller while the REPL Input is below it, else the document."
  (:require
   [calva.repl.webview.near-colors :as near-colors]))

(defonce ^{:private true
           :doc "The running observers of the output blocks, the output's children and the body's class."}
  !observers
  (atom nil))

(defn observers
  "Returns the running observers, `:blocks`, `:children` and `:body`, or nil."
  []
  @!observers)

(defn near-updates
  "Returns `[block near?]` for each of the IntersectionObserver `entries`: near in the observed range."
  [entries]
  (mapv (fn [^js entry] [(.-target entry) (.-isIntersecting entry)]) entries))

(defn- accessibility-support?
  []
  (= "on" (.. js/document -body (getAttribute "data-accessibility-support"))))

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

(defn- observe!
  "Observes `block` with `blocks`. While accessibility support is on, hides it until it is found near the
   view."
  [^js blocks block]
  (when (accessibility-support?)
    (set-aria-hidden! [block true]))
  (.observe blocks block))

(defn- on-near-updates!
  [entries]
  (let [hide? (accessibility-support?)]
    (doseq [[block near?] (near-updates entries)]
      (near-colors/set-near! block near?)
      (when hide?
        (set-aria-hidden! [block (not near?)])))))

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
  "Observes the blocks in `output-element`, and the blocks added to it, as near or farther than `margin`, an
   IntersectionObserver root margin, from view. Starts again from the other root when the REPL Input comes or
   goes."
  [^js output-element margin]
  (disconnect!)
  (near-colors/forget-reports!)
  (let [root (scroll-root)
        blocks (js/IntersectionObserver. on-near-updates! #js {:root root :rootMargin margin})
        children (js/MutationObserver.
                  (fn [records]
                    (doseq [^js record records]
                      (doseq [node (array-seq (.-addedNodes record)) :when (block? node)]
                        (observe! blocks node))
                      (doseq [node (array-seq (.-removedNodes record)) :when (block? node)]
                        (.unobserve blocks node)))))
        body (js/MutationObserver. #(when-not (identical? root (scroll-root))
                                      (start! output-element margin)))]
    (doseq [block (array-seq (.-children output-element))]
      (observe! blocks block))
    (.observe children output-element #js {:childList true})
    (.observe body js/document.body #js {:attributes true :attributeFilter #js ["class"]})
    (reset! !observers {:blocks blocks :children children :body body})))

(defn restart!
  "Starts the running observers again with the page's margin, as after a change of the font size."
  [^js output-element]
  (when @!observers
    (start! output-element (page-root-margin))))

(defn- hide-output!
  "Hides all of `output-element` from screen readers, in place of hiding its blocks one by one."
  [^js output-element]
  (doseq [^js block (array-seq (.-children output-element))]
    (.removeAttribute block "aria-hidden"))
  (.setAttribute output-element "aria-hidden" "true"))

(defn set-accessibility-support!
  "Shows screen readers the output in `output-element` near the visible part with `accessibility-support?`,
   within `accessibility-page-size` lines, and otherwise hides all of it from them and puts the
   `accessibility-note`, HTML, in the `note` element. Observes the blocks again with the page size."
  [^js output-element ^js note {:keys [accessibility-support? accessibility-page-size accessibility-note]}]
  (.. js/document -body (setAttribute "data-accessibility-support" (if accessibility-support? "on" "off")))
  (.. js/document -body (setAttribute "data-accessibility-page-size" (str accessibility-page-size)))
  (if accessibility-support?
    (.removeAttribute output-element "aria-hidden")
    (hide-output! output-element))
  (start! output-element (page-root-margin))
  (when note
    (set! (.-innerHTML note) (if accessibility-support? "" (or accessibility-note "")))))
