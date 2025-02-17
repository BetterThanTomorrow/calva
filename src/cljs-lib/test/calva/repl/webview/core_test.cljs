(ns calva.repl.webview.core-test
  (:require [cljs.test :refer-macros [deftest testing is run-tests]]
            [calva.repl.webview.core :as core]))

(deftest dispose-repl-output-webview-panel-test
  (testing "Given an atom holding some value, should set the value to nil"
    (let [webview-panel-atom (atom {:mock "webview-panel"})]
      (core/dispose-repl-output-webview-panel webview-panel-atom)
      (is (= nil @webview-panel-atom)))))

(deftest post-message-to-webview-test
  (testing "Given a webview panel and a message, should post the message to the webview panel with an :id attribute added to it"
    (let [])))

(run-tests)
