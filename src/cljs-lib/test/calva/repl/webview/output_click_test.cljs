(ns calva.repl.webview.output-click-test
  "Clicks in the output dispatch the actions of the clicked control."
  (:require
   [calva.repl.webview.fake-document :as fake-document]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest is]]))

(defn- with-selection
  "Calls `f` with `js/window` giving a selection that is collapsed or not."
  [collapsed? f]
  (let [had-window? (exists? js/window)
        window (when had-window? js/window)]
    (set! js/globalThis.window #js {:getSelection (fn [] #js {:isCollapsed collapsed?
                                                              :containsNode (fn [_ _] true)})})
    (try
      (f)
      (finally
        (if had-window?
          (set! js/globalThis.window window)
          (js-delete js/globalThis "window"))))))

(deftest plain-click-test
  (let [row (fake-document/hiccup-element [:div {:data-action (pr-str [[:error/ax.toggle "e1"]])
                                                 :data-plain-click true}
                                           [:pre "Execution error"]])
        text (.querySelector row "pre")
        dispatched (atom [])]
    (with-redefs [ui/dispatch! #(swap! dispatched conj %)]
      (with-selection false #(ui/on-output-click #js {:target text :detail 1}))
      (is (= [] @dispatched)
          "A click that ends a text selection in the row does nothing")
      (with-selection true #(ui/on-output-click #js {:target text :detail 1}))
      (is (= [[:error/ax.toggle "e1"]] @dispatched)
          "A click without a selection dispatches the row's action"))))

(deftest event-target-in-actions-test
  (let [button (fake-document/hiccup-element [:button {:data-action (pr-str [[:output/ax.copy-image {:image/mime "image/png"
                                                                                                     :copy/button :event/target}]])}])
        dispatched (atom [])]
    (with-redefs [ui/dispatch! #(swap! dispatched conj %)]
      (ui/on-output-click #js {:target button :detail 1}))
    (is (= [[:output/ax.copy-image {:image/mime "image/png" :copy/button button}]] @dispatched)
        ":event/target in an action's payload stands for the clicked control")))
