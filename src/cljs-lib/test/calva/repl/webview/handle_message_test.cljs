(ns calva.repl.webview.handle-message-test
  (:require
   [calva.repl.webview.fake-document :as fake-document]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest is]]))

(deftest accessibility-support-follows-the-setting
  (let [output (fake-document/hiccup-element [:div {:id "output" :aria-hidden "true"}])
        note (fake-document/hiccup-element [:p {:id "output-hidden-note"} "Hidden"])
        get-element-by-id (.-getElementById js/document)
        message (fn [on?]
                  #js {:data (pr-str {:command/name "set-accessibility-support"
                                      :accessibility-support? on?
                                      :accessibility-note "Hidden"})})
        state (fn []
                {:aria-hidden (.getAttribute output "aria-hidden")
                 :note (.-textContent note)
                 :body (.. js/document -body (getAttribute "data-accessibility-support"))})]
    (set! (.-getElementById js/document) (fn [id] (when (= "output-hidden-note" id) note)))
    (try
      (with-redefs [ui/output-dom-element output]
        (ui/handle-message (message true))
        (is (= {:aria-hidden nil :note "" :body "on"} (state))
            "On, the output is readable, and the note is empty")
        (ui/handle-message (message false))
        (is (= {:aria-hidden "true" :note "Hidden" :body "off"} (state))
            "Off, the output is hidden, and the note says so"))
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
