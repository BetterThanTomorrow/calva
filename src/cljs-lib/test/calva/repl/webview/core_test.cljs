(ns calva.repl.webview.core-test
  (:require
   [calva.repl.webview.core :as sut]
   [calva.util :as util]
   [cljs.reader :as reader]
   [cljs.test :refer-macros [deftest testing is run-tests]]
   [spy.core :as spy]))

(defn wrap-spy
  "This is a helper that returns a function that calls the spy, so that the shadow-cljs doesn't complain,
   which is does if a spy is used and called directly in a test - it will say the thing is not a function"
  [spy]
  (fn [& args]
    (apply spy args)))

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
            message-arg (reader/read-string (ffirst calls))]
        (is (= 1 (count calls)))
        (is (= "world" (:hello message-arg)))
        (is (string? (:id message-arg)))))))

(deftest get-webview-html-test
  (testing "Given valid args and that the environment is debug, should return the expected html markup"
    (let [result (sut/get-webview-html {:env/is-debug true} {:js-source "js-source"
                                                             :css-href "css-href"
                                                             :csp-source "csp-source"})]
      (is (= 1 (count (re-seq #"js-source" result))))
      (is (= 1 (count (re-seq #"css-href" result))))
      ;; It should be in the style-src and script-src directives in the content security policy
      (is (= 2 (count (re-seq #"csp-source" result))))
      (is (= 1 (count (re-seq #"'unsafe-eval'" result))))
      (is (= 1 (count (re-seq #"connect-src ws://localhost:9630/api/remote-relay" result))))))
  (testing "Given valid args and that the environment is not debug, should return the expected html markup"
    (let [result (sut/get-webview-html {:env/is-debug false} {:js-source "js-source"
                                                              :css-href "css-href"
                                                              :csp-source "csp-source"})]
      (is (= 1 (count (re-seq #"js-source" result))))
      (is (= 1 (count (re-seq #"css-href" result))))
      ;; It should be in the style-src and script-src directives in the content security policy
      (is (= 2 (count (re-seq #"csp-source" result))))
      (is (zero? (count (re-seq #"'unsafe-eval'" result))))
      (is (zero? (count (re-seq #"connect-src ws://localhost:9630/api/remote-relay" result)))))))

(deftest get-js-source-test
  (testing "Given a context and a webview-panel,"
    (let [join-path-spy (spy/stub "some-path")
          extension-uri "extension-uri"
          context {:vscode/context (clj->js {:extensionUri extension-uri})
                   :vscode/vscode (clj->js {:Uri {:joinPath (wrap-spy join-path-spy)}})}
          as-webview-uri-spy (spy/stub "some-webview-uri")
          webview-panel (clj->js {:webview {:asWebviewUri (wrap-spy as-webview-uri-spy)}})
          result (sut/get-js-source context {:webview-panel webview-panel})]
      (testing "should call joinPath with expected args"
        (is (spy/called-once-with? join-path-spy extension-uri "repl-output-ui" "js" "main.js")))
      (testing "should call asWebviewUri with result of call to joinPath"
        (is (spy/called-once-with? as-webview-uri-spy "some-path")))
      (testing "should return result of call to asWebviewUri"
        (is (= "some-webview-uri" result))))))

(deftest get-css-path
  (testing "Given a context"
    (let [join-path-spy (spy/stub "some-path")
          extension-uri "extension-uri"
          context {:vscode/context (clj->js {:extensionUri extension-uri})
                   :vscode/vscode (clj->js {:Uri {:joinPath (wrap-spy join-path-spy)}})}
          result (sut/get-css-path context)]
      (testing "should call joinPath with expected args"
        (is (spy/called-once-with? join-path-spy extension-uri "repl-output-ui" "css" "main.css")))
      (testing "should return the result of joinPath"
        (is (= "some-path" result))))))

(deftest set-webview-html!-test
  (testing "Given a context and a webview panel"
    (let [context {:some "context"}
          get-js-source-spy (spy/stub "some-js-source")
          get-css-path-spy (spy/stub "some-css-path")
          as-webview-uri-spy (spy/stub "some-css-href")
          ^js webview-panel (clj->js {:webview {:asWebviewUri (wrap-spy as-webview-uri-spy)
                                                :cspSource "some-csp-source"}})
          get-webview-html-spy (spy/stub "some-html")]
      (with-redefs [sut/get-js-source (wrap-spy get-js-source-spy)
                    sut/get-css-path (wrap-spy get-css-path-spy)
                    sut/get-webview-html (wrap-spy get-webview-html-spy)]
        (sut/set-webview-html! context {:webview-panel webview-panel})
        (testing "should call get-js-source with expected args"
          (is (spy/called-once-with? get-js-source-spy context {:webview-panel webview-panel})))
        (testing "should call get-css-path with expected args"
          (is (spy/called-once-with? get-css-path-spy context)))
        (testing "should call asWebviewUri with expected args"
          (is (spy/called-once-with? as-webview-uri-spy "some-css-path")))
        (testing "should call get-webview-html with expected args"
          (is (spy/called-once-with? get-webview-html-spy context {:js-source "some-js-source"
                                                                   :css-href "some-css-href"
                                                                   :csp-source "some-csp-source"})))
        (testing "should set webview html to result of call to get-webview-html"
          (is (= "some-html" (.. webview-panel -webview -html))))))))

(deftest set-code-theme!-test
  (testing "Given a context and a ColorThemeKind,"
    (let [color-theme-kind-enum {:Dark 0
                                 :Light 1
                                 :HighContrast 2
                                 :HighContrastLight 3}
          context {:vscode/vscode (clj->js {:ColorThemeKind color-theme-kind-enum})}
          webview-panel {:some "mock-webview-panel"}]
      (testing "when the ColorThemeKind is Dark, should set the code theme to dark"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:Dark color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :content "dark"})))))
      (testing "when the ColorThemeKind is Light, should set the code theme to light"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:Light color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :content "light"})))))
      (testing "when the ColorThemeKind is HighContrast, should set the code theme to high-contrast"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:HighContrast color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :content "high-contrast"})))))
      (testing "when the ColorThemeKind is HighContrastLight, should set the code theme to high-contrast-light"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:HighContrastLight color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :content "high-contrast-light"})))))
      (testing "when there is no configured code theme for the ColorThemeKind, should log the expected error"
        (let [log-to-console-spy (spy/spy)
              color-theme-kind 99]
          (with-redefs [util/log-to-console (wrap-spy log-to-console-spy)]
            (sut/set-code-theme! context {:color-theme-kind color-theme-kind
                                          :webview-panel webview-panel})
            (is (spy/called-once-with?
                 log-to-console-spy
                 :error
                 "Cannot set code theme in output webview. There is no code theme set for the ColorThemeKind enum value of"
                 color-theme-kind))))))))

(deftest create-color-theme-change-listener-test
  (testing "Given a context and a webview panel, should call onDidChangeActiveColorTheme and pass it a function"
    (let [on-did-change-active-color-theme-spy (spy/spy)
          context {:vscode/vscode (clj->js {:window {:onDidChangeActiveColorTheme
                                                     (wrap-spy on-did-change-active-color-theme-spy)}})}]
      (sut/create-color-theme-change-listener context {:webview-panel {:some "webview-panel"}})
      (let [calls (spy/calls on-did-change-active-color-theme-spy)]
        (is (= 1 (count calls)))
        (is (fn? (type (ffirst calls))))))))

(run-tests)
