(ns calva.repl.webview.input.tooltip
  "The tooltips of the REPL Input's controls, which the view draws itself as hint popovers, since `title`
   tooltips are unreliable in webviews.")

(defn element
  "Returns the tooltip of `control`, with the id `id` and `text`, to be added next to `control`. It shows
   on hover and on keyboard focus, through `interestfor`, and hides on a click."
  [^js control id text]
  (let [tip (doto (js/document.createElement "div")
              (-> .-id (set! id))
              (-> .-className (set! "repl-input-tooltip"))
              (.setAttribute "popover" "hint")
              (-> .-textContent (set! text)))]
    (.setAttribute control "interestfor" id)
    (.addEventListener control "click" #(.hidePopover tip))
    tip))

(defn set-text!
  "Shows `text` in the tooltip of `control`."
  [^js control text]
  (some-> (.-interestForElement control) (-> .-textContent (set! text))))
