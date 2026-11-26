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

(defn hide!
  "Hides the page's tooltip."
  []
  (some-> ^js (:tip @!shown) .hidePopover))

(defn attributes
  "Returns the attributes that give a control in hiccup, a button or a link, the page's tooltip with `text`,
   which is also its accessible description. A click on the control is to call `hide!`."
  [text]
  {:interestfor id :aria-description text})

(defn attach!
  "Gives `control`, a button or a link, the page's tooltip with `text`, which is also its accessible
   description. It shows on hover and on keyboard focus, and hides on a click."
  [^js control text]
  (doseq [[k v] (attributes text)]
    (.setAttribute control (name k) v))
  (doto control
    (.addEventListener "click" hide!)))

(defn refresh!
  "Shows the text of the control the tooltip shows for, after its accessible description changed."
  []
  (let [{:keys [^js tip ^js control]} @!shown]
    (when tip
      (set! (.-textContent tip) (.getAttribute control "aria-description")))))
