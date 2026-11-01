(ns calva.repl.webview.auto-scroll
  "Auto scrolling in an Output view's page. While it is on, the output scrolls to its end when output is
   appended. It turns off when the user scrolls up with the end of the output out of view, and on again
   when the end comes into view. `#output-end`, an element over the last pixels of the output, marks the
   end.")

(def end-id "output-end")

(defonce ^:private !on? (atom true))

(defonce ^{:private true :doc "Where the page and the output's own scroller were last scrolled to, by the user or the page."}
  !tops (atom {}))

(defn scrolled-up?
  "True when `target` scrolled to `top`, above where `tops` has it last."
  [tops target top]
  (< top (get tops target top)))

(defn after-scroll
  "Returns whether auto scrolling is on after a scroll, from `on?` before it: on when the end of the output
   is in view, off when the scroll went up, else as it was."
  [on? {:keys [up? end-visible?]}]
  (cond
    end-visible? true
    up? false
    :else on?))

(defn- end-visible?
  "True when the end of the output is in the part of the page that shows, with the output's own scroller
   when the REPL Input is below it."
  [^js end]
  (let [scroller (js/document.getElementById "output-scroller")
        bottom (min js/window.innerHeight (.-bottom (.getBoundingClientRect scroller)))]
    (<= (.-top (.getBoundingClientRect end)) bottom)))

(defn- output-scroll-top
  "Returns the scroll position of `target` when it scrolls the output, the page or the output's own
   scroller. Else nil."
  [^js target]
  (cond
    (= target js/document) js/window.scrollY
    (= "output-scroller" (.-id target)) (.-scrollTop target)))

(defn- scroll-to-end!
  "Scrolls the output to its end, in the page, or in its own scroller when the REPL Input is below it, and
   keeps where it left them."
  []
  (when-let [^js scroller (js/document.getElementById "output-scroller")]
    (set! (.-scrollTop scroller) (.-scrollHeight scroller))
    (js/scrollTo 0 js/document.documentElement.scrollHeight)
    (swap! !tops assoc scroller (.-scrollTop scroller) js/document js/window.scrollY)))

(defn follow!
  "Scrolls the output to its end while auto scrolling is on."
  []
  (when @!on?
    (scroll-to-end!)))

(defn reveal-end!
  "Turns auto scrolling on, and scrolls the output to its end."
  []
  (reset! !on? true)
  (scroll-to-end!))

(defn- on-scroll
  [^js end ^js event]
  (let [target (.-target event)]
    (when-let [top (output-scroll-top target)]
      (let [[before _] (swap-vals! !tops assoc target top)]
        (swap! !on? after-scroll {:up? (scrolled-up? before target top)
                                  :end-visible? (end-visible? end)})))))

(defn listen!
  "Turns auto scrolling on when the end of the output comes into view, and follows the user's scrolling."
  []
  (when-let [end (js/document.getElementById end-id)]
    (.observe (js/IntersectionObserver. (fn [entries]
                                          (when (some #(.-isIntersecting ^js %) entries)
                                            (reset! !on? true)))
                                        #js {:root js/document})
              end)
    (js/document.addEventListener "scroll" #(on-scroll end %) true)))
