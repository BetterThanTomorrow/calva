(ns calva.repl.webview.handle-message-test
  (:require
   [calva.repl.webview.fake-document :as fake-document]
   [calva.repl.webview.ui :as ui]
   [calva.repl.webview.viewport-observer :as viewport-observer]
   [cljs.test :refer-macros [deftest is]]))

(deftest accessibility-support-follows-the-setting
  (let [output (fake-document/hiccup-element [:div {:id "output" :aria-hidden "true"} [:pre "a"] [:pre "b"]])
        note #js {:innerHTML ""}
        get-element-by-id (.-getElementById js/document)
        message (fn [on?]
                  #js {:data (pr-str {:command/name "set-accessibility-support"
                                      :accessibility-support? on?
                                      :accessibility-page-size 500
                                      :accessibility-note (when-not on? [:span "Hidden"])})})
        state (fn []
                {:aria-hidden (.getAttribute output "aria-hidden")
                 :blocks-aria-hidden (mapv #(.getAttribute ^js % "aria-hidden") (.-children output))
                 :note (.-innerHTML note)
                 :body (.. js/document -body (getAttribute "data-accessibility-support"))})]
    (set! (.-getElementById js/document) (fn [id] (when (= "output-hidden-note" id) note)))
    (try
      (with-redefs [ui/output-dom-element output
                    viewport-observer/page-root-margin (constantly "300px 0px")]
        (ui/handle-message (message true))
        (is (= {:aria-hidden nil :blocks-aria-hidden ["true" "true"] :note "" :body "on"} (state))
            "On, the output is readable, its blocks hidden until found near the view, and the note is empty")
        (ui/handle-message (message false))
        (is (= {:aria-hidden "true" :blocks-aria-hidden [nil nil] :note "<span>Hidden</span>" :body "off"} (state))
            "Off, the output is hidden as a whole, and the note says so"))
      (finally
        (set! (.-getElementById js/document) get-element-by-id)))))

(deftest unknown-message-is-ignored
  (let [logged (atom [])
        console-error js/console.error]
    (set! js/console.error (fn [& args] (swap! logged conj args)))
    (try
      (ui/handle-message #js {:data (pr-str {:command/name "no-such-message"})})
      (finally
        (set! js/console.error console-error)))
    (is (= [["No handler for message" "no-such-message"]] (mapv vec @logged))
        "An unknown message is logged, not thrown")))
