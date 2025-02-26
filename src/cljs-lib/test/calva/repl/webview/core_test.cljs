(ns calva.repl.webview.core-test
  (:require
   [calva.repl.webview.core :as sut]
   [cljs.test :refer-macros [deftest testing is run-tests]]
   [clojure.string :as str]
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

(deftest get-webview-html-test
  (testing "Given valid args and that the environment is debug, should return the expected html markup"
    (set! js/process.env.IS_DEBUG "true")
    (let [result (sut/get-webview-html "js-source" "css-href" "csp-source")]
      (is (= 1 (count (re-seq #"js-source" result))))
      (is (= 1 (count (re-seq #"css-href" result))))
      ;; It should be in the style-src and script-src directives in the content security policy
      (is (= 2 (count (re-seq #"csp-source" result))))
      (is (= 1 (count (re-seq #"'unsafe-eval'" result))))
      (is (= 1 (count (re-seq #"connect-src ws://localhost:9630/api/remote-relay" result))))))
  (testing "Given valid args and that the environment is not debug, should return the expected html markup"
    (set! js/process.env.IS_DEBUG "false")
    (let [result (sut/get-webview-html "js-source" "css-href" "csp-source")]
      (is (= 1 (count (re-seq #"js-source" result))))
      (is (= 1 (count (re-seq #"css-href" result))))
      ;; It should be in the style-src and script-src directives in the content security policy
      (is (= 2 (count (re-seq #"csp-source" result))))
      (is (zero? (count (re-seq #"'unsafe-eval'" result))))
      (is (zero? (count (re-seq #"connect-src ws://localhost:9630/api/remote-relay" result)))))
    ;; Set it back just to make sure there are no unexpected side effects when developing in the repl
    (set! js/process.env.IS_DEBUG "true")))

(run-tests)

(comment
  (set! js/process.env.IS_DEBUG "false")
  (count (re-seq #"csp-source" "ccsp-sourceecsp-source"))

  :rcf)
