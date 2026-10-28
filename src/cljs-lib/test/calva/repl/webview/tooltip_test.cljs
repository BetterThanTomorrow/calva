(ns calva.repl.webview.tooltip-test
  (:require
   [calva.repl.webview.fake-document]
   [calva.repl.webview.tooltip :as tooltip]
   [cljs.test :refer-macros [deftest is use-fixtures]]))

(def ^:private !resize-callback (atom nil))

(defn- fake-resize-observer
  [callback]
  (reset! !resize-callback callback)
  #js {:observe (fn [_]) :disconnect (fn [])})

(use-fixtures :each
  {:before #(set! js/globalThis.ResizeObserver fake-resize-observer)
   :after #(js-delete js/globalThis "ResizeObserver")})

(defn- show-interest!
  "Fires the tooltip's interest listener as the browser does when `control` shows interest in it."
  [^js tip control]
  (doseq [^js listener (.-calvaListeners tip)
          :when (= "interest" (.-type listener))]
    ((.-f listener) #js {:source control})))

(deftest attached-control
  (let [tip (tooltip/element)
        button (tooltip/attach! (js/document.createElement "button") "Copy output")]
    (is (= "hint" (.getAttribute tip "popover")))
    (is (= (.-id tip) (.getAttribute button "interestfor"))
        "The control shows the page's tooltip")
    (is (= "Copy output" (.getAttribute button "aria-description"))
        "The tooltip's text is the control's accessible description")
    (is (nil? (.-title button))
        "The control has no VS Code tooltip")))

(deftest tooltip-text
  (let [tip (tooltip/element)
        copy (tooltip/attach! (js/document.createElement "button") "Copy output")
        play (tooltip/attach! (js/document.createElement "button") "Evaluate")]
    (show-interest! tip copy)
    (is (= "Copy output" (.-textContent tip))
        "The tooltip takes the text of the control that shows interest")
    (show-interest! tip play)
    (is (= "Evaluate" (.-textContent tip)))
    (tooltip/set-text! play "Connect a REPL")
    (is (= "Connect a REPL" (.-textContent tip))
        "A new text shows while the tooltip shows for the control")
    (tooltip/set-text! copy "Copy")
    (is (= "Connect a REPL" (.-textContent tip))
        "Another control's new text waits until it shows the tooltip")
    (show-interest! tip copy)
    (is (= "Copy" (.-textContent tip)))))

(deftest tooltip-hides-with-its-control
  (let [tip (tooltip/element)
        hidden (atom 0)
        resized! (fn [width] (@!resize-callback #js [#js {:contentRect #js {:width width}}]))]
    (set! (.-hidePopover tip) #(swap! hidden inc))
    (resized! 16)
    (is (zero? @hidden) "A shown control keeps the tooltip")
    (resized! 0)
    (is (= 1 @hidden) "A control that hides or leaves the page takes the tooltip with it")))
