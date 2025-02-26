(ns calva.repl.webview.core-test
  (:require [cljs.test :refer-macros [deftest testing is run-tests]]
            [calva.repl.webview.core :as sut]
            [spy.core :as spy]))

(deftest dispose-repl-output-webview-panel-test
  (testing "Given an atom holding some value, should set the value to nil"
    (let [webview-panel-atom (atom {:mock "webview-panel"})]
      (sut/dispose-repl-output-webview-panel webview-panel-atom)
      (is (= nil @webview-panel-atom)))))

(deftest post-message-to-webview-test
  (testing "Given a webview panel and a message, should post the message to the webview panel with an :id attribute added to it"
    (let [post-message-spy (spy/spy)
          ;; Using spy this way is a workaround to avoid an error mentioned in this issue:
          ;; https://github.com/alexanderjamesking/spy/issues/29
          ;; I tried setting static-fns to false in the build config's compiler-options, but that didn't fix the issue
          webview-panel-mock (clj->js {:webview {:postMessage (fn [& args] (apply post-message-spy args))}})
          message {:hello "world"}]
      (sut/post-message-to-webview webview-panel-mock message)
      (let [calls (spy/calls post-message-spy)
            ^js message-arg (ffirst calls)]
        (is (= 1 (count calls)))
        (is (= "world" (.-hello message-arg)))
        (is (string? (.-id message-arg)))))))

(comment
  (run-tests)
  :rcf)
