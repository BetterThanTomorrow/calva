(ns calva.repl.webview.tooltip
  "The tooltip of the Output views' controls: one hint popover for the page, which every control shows
   through `interestfor`, since `title` tooltips are unreliable in webviews.")

(def ^:private id "output-tooltip")

(defonce ^:private !shown (atom nil))

(defn element
  "Returns the page's tooltip, to be added to the page once. It shows the text of the control that shows
   interest in it, and hides when that control hides or leaves the page."
  []
  (let [tip (doto (js/document.createElement "div")
              (-> .-id (set! id))
              (-> .-className (set! "output-tooltip"))
              (.setAttribute "popover" "hint"))
        watch (js/ResizeObserver.
               (fn [entries]
                 (when (some #(zero? (.. ^js % -contentRect -width)) entries)
                   (.hidePopover tip))))]
    (.addEventListener tip "interest"
                       (fn [^js event]
                         (let [^js control (.-source event)]
                           (reset! !shown {:tip tip :control control})
                           (set! (.-textContent tip) (.getAttribute control "aria-description"))
                           (doto watch .disconnect (.observe control)))))
    tip))

(defn attach!
  "Gives `control`, a button or a link, the page's tooltip with `text`, which is also its accessible
   description. It shows on hover and on keyboard focus, and hides on a click."
  [^js control text]
  (doto control
    (.setAttribute "interestfor" id)
    (.setAttribute "aria-description" text)
    (.addEventListener "click" #(some-> ^js (:tip @!shown) .hidePopover))))

(defn set-text!
  "Shows `text` in the tooltip of `control`, also while it shows."
  [^js control text]
  (.setAttribute control "aria-description" text)
  (let [{:keys [^js tip] shown-for :control} @!shown]
    (when (identical? control shown-for)
      (set! (.-textContent tip) text))))
