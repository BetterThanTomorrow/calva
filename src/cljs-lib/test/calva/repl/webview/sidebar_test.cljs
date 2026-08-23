(ns calva.repl.webview.sidebar-test
  (:require
   [calva.repl.webview.core :as core]
   [calva.repl.webview.sidebar :as sut]
   [cljs.test :refer-macros [deftest testing is]]
   [spy.core :as spy]
   [test-util :as test-util]
   [calva.util :as util]))

(deftest output-sidebar-in-setting?-test
  (testing "recognizes string destinations"
    (is (sut/output-sidebar-in-setting? {:evalResults "output-sidebar"}))
    (is (not (sut/output-sidebar-in-setting? {:evalResults "terminal"}))))
  (testing "recognizes output-sidebar in a top-level destination array"
    (is (sut/output-sidebar-in-setting? {:evalResults ["terminal" "output-sidebar"]})))
  (testing "skips nested destination arrays"
    (is (not (sut/output-sidebar-in-setting? {:evalResults [["output-sidebar"]]})))))

(deftest get-sidebar-help-html-test
  (let [destinations #js {:evalResults "terminal"
                          :evalOutput "terminal"
                          :otherOutput "terminal"}]
    (with-redefs [sut/current-output-destinations (constantly destinations)]
      (let [html (sut/get-sidebar-help-html "csp-source")]
        (is (re-find #"REPL Output" html))
        (is (re-find #"terminal" html))
        (is (re-find #"https://calva.io/output" html))
        (is (re-find #"default-src 'none'; style-src csp-source" html))))))

(deftest resolve-webview-view-test
  (let [on-did-dispose-spy (spy/stub "dispose-subscription")
        on-did-change-visibility-spy (spy/stub "visibility-subscription")
        on-did-change-configuration-spy (spy/stub "configuration-subscription")
        webview-view #js {:webview #js {:cspSource "csp-source"}
                          :visible false
                          :onDidDispose (test-util/wrap-spy on-did-dispose-spy)
                          :onDidChangeVisibility (test-util/wrap-spy on-did-change-visibility-spy)}
        vscode-stub #js {:workspace #js {:onDidChangeConfiguration
                                         (test-util/wrap-spy on-did-change-configuration-spy)}}
        vscode-context-stub #js {:extensionUri "extension-uri"
                                 :subscriptions #js []}
        destinations #js {:evalResults "terminal"}]
    (with-redefs [util/vscode (atom vscode-stub)
                  util/vscode-context (atom vscode-context-stub)
                  sut/current-output-destinations (constantly destinations)
                  sut/output-sidebar-webview-view (atom nil)]
      (let [provider (sut/create-repl-output-sidebar-provider)
            resolve-webview-view (.-resolveWebviewView provider)]
        (resolve-webview-view webview-view nil nil)
        (is (= webview-view @sut/output-sidebar-webview-view))
        (is (re-find #"REPL Output" (.. ^js webview-view -webview -html)))
        (testing "should register a configuration-change callback"
          (let [calls (spy/calls on-did-change-configuration-spy)]
            (is (= 1 (count calls)))
            (is (fn? (type (first (first calls)))))))
        (testing "should register a visibility-change callback"
          (let [calls (spy/calls on-did-change-visibility-spy)]
            (is (= 1 (count calls)))
            (is (fn? (type (first (first calls)))))))
        ((ffirst (spy/calls on-did-dispose-spy)))
        (is (nil? @sut/output-sidebar-webview-view))))))

(deftest show-repl-output-sidebar-test
  (let [show-spy (spy/spy)
        webview-view #js {:show (test-util/wrap-spy show-spy)}]
    (with-redefs [sut/output-sidebar-webview-view (atom webview-view)]
      (sut/show-repl-output-sidebar false)
      (is (spy/called-once-with? show-spy false)))))

(deftest append-test
  (let [post-message-to-webview-spy (spy/spy)
        options (clj->js {:outputCategory "evalOut"})]
    (with-redefs [sut/current-output-destinations (constantly {:evalOutput "output-sidebar"})
                  sut/output-sidebar-webview-view (atom nil)
                  sut/output-sidebar-log (atom [])
                  core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
      (sut/append options "some-output")
      (is (= [{:command/name "show-stdout" :output "some-output"}]
             @sut/output-sidebar-log))
      (is (spy/not-called? post-message-to-webview-spy)))))

(deftest append-stacktrace-test
  (let [post-message-to-webview-spy (spy/spy)
        webview-view #js {:webview #js {}}]
    (with-redefs [sut/current-output-destinations (constantly {:evalOutput "output-sidebar"})
                  sut/output-sidebar-webview-view (atom webview-view)
                  sut/output-sidebar-log (atom [])
                  core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)
                  core/stacktrace->message (constantly "stacktrace")]
      (sut/append-stacktrace (clj->js []))
      (is (= [{:command/name "show-stdout" :output "stacktrace"}]
             @sut/output-sidebar-log))
      (is (spy/called-once-with? post-message-to-webview-spy
                                 webview-view
                                 {:command/name "show-stdout"
                                  :output "stacktrace"})))))

(deftest clear-output-sidebar-test
  (let [post-message-to-webview-spy (spy/spy)
        webview-view #js {:webview #js {}}
        output-log (atom [{:command/name "show-stdout" :output "old"}])]
    (with-redefs [sut/output-sidebar-webview-view (atom webview-view)
                  sut/output-sidebar-showing-output-log? (atom false)
                  sut/output-sidebar-log output-log
                  core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
      (sut/clear-output-sidebar)
      (is (= [] @output-log))
      (is (spy/called-once-with? post-message-to-webview-spy
                                 webview-view
                                 {:command/name "clear-output-view"}))))
  (let [post-message-to-webview-spy (spy/spy)
        output-log (atom [{:command/name "show-stdout" :output "old"}])]
    (with-redefs [sut/output-sidebar-webview-view (atom nil)
                  sut/output-sidebar-log output-log
                  core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
      (sut/clear-output-sidebar)
      (is (= [] @output-log))
      (is (spy/not-called? post-message-to-webview-spy)))))

(deftest resolve-output-log-test
  (let [on-did-change-configuration-spy (spy/stub "configuration-subscription")
        webview-view #js {:webview #js {:cspSource "csp-source"}
                          :visible true
                          :onDidDispose (constantly "dispose-subscription")
                          :onDidChangeVisibility (constantly "visibility-subscription")}
        vscode-stub #js {:workspace #js {:onDidChangeConfiguration
                                         (test-util/wrap-spy on-did-change-configuration-spy)}
                         :window #js {:activeColorTheme #js {:kind 1}}}
        vscode-context-stub #js {:extensionUri "extension-uri"
                                 :subscriptions #js []}
        output-log [{:command/name "show-stdout" :output "first"}
                    {:command/name "show-result" :output "second"}]
        set-webview-html!-spy (spy/spy)
        set-code-theme!-spy (spy/spy)
        post-message-to-webview-spy (spy/spy)]
    (with-redefs [util/vscode (atom vscode-stub)
                  util/vscode-context (atom vscode-context-stub)
                  sut/current-output-destinations (constantly {:evalResults "output-sidebar"})
                  sut/output-sidebar-webview-view (atom nil)
                  sut/output-sidebar-log (atom output-log)
                  core/set-webview-html! (test-util/wrap-spy set-webview-html!-spy)
                  core/set-code-theme! (test-util/wrap-spy set-code-theme!-spy)
                  core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
      (let [resolve-webview-view (.-resolveWebviewView (sut/create-repl-output-sidebar-provider))]
        (resolve-webview-view webview-view nil nil)
        (resolve-webview-view webview-view nil nil)
        (is (= output-log @sut/output-sidebar-log))
        (is (= 2 (count (spy/calls set-webview-html!-spy))))
        (is (= 2 (count (spy/calls set-code-theme!-spy))))
        (is (= 4 (count (spy/calls post-message-to-webview-spy))))
        (is (= ["first" "second" "first" "second"]
               (map #(-> % second :output) (spy/calls post-message-to-webview-spy))))))))
