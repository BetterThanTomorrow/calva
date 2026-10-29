(ns calva.repl.webview.handle-message-test
  (:require
   [calva.repl.webview.fake-document]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest is]]))

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
