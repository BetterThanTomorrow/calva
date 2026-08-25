(ns calva.repl.webview.core-test
  (:require
   [calva.repl.webview.core :as sut]
   [calva.repl.webview.greeting :as greeting]
   [cljs.reader :as reader]
   [cljs.test :refer-macros [deftest testing is]]
   [matcher-combinators.test]
   [spy.core :as spy]
   [test-util :as test-util]
   [calva.util :as util]))

(deftest dispose-repl-output-webview-panel-test
  (testing "Given an atom holding some value, should set the value to nil"
    (let [webview-panel-atom (atom {:mock "webview-panel"})]
      (sut/dispose-repl-output-webview-panel webview-panel-atom)
      (is (= nil @webview-panel-atom)))))

(deftest post-message-to-webview-test
  (testing "Given a webview panel and a message, should post the message to the webview panel with an :id attribute added to it"
    (let [post-message-spy (spy/spy)
          webview-panel-mock (clj->js {:webview {:postMessage (test-util/wrap-spy post-message-spy)}})
          message {:hello "world"}]
      (sut/post-message-to-webview webview-panel-mock message)
      (let [calls (spy/calls post-message-spy)
            message-arg (reader/read-string (ffirst calls))]
        (is (= 1 (count calls)))
        (is (= "world" (:hello message-arg)))
        (is (string? (:id message-arg)))))))

(defn vscode-with-editor-word-wrap-setting
  [setting]
  #js {:workspace #js {:getConfiguration (fn [_section] #js {:get (fn [_setting] setting)})}})

(deftest webview-registration-test
  (testing "registers and unregisters webviews"
    (let [webview-a #js {}
          webview-b #js {}]
      (with-redefs [sut/registered-webviews (atom #{})]
        (sut/register-webview! webview-a)
        (sut/register-webview! webview-b)
        (is (= #{webview-a webview-b} @sut/registered-webviews))
        (sut/unregister-webview! webview-a)
        (is (= #{webview-b} @sut/registered-webviews))))))

(deftest word-wrap-test
  (testing "uses the editor wordWrap setting when there is no override"
    (with-redefs [sut/word-wrap-override (atom nil)
                  sut/get-editor-word-wrap-setting (constantly true)]
      (is (true? (sut/word-wrap?)))))
  (testing "uses override when present"
    (with-redefs [sut/word-wrap-override (atom false)
                  sut/get-editor-word-wrap-setting (constantly true)]
      (is (false? (sut/word-wrap?))))))

(deftest get-editor-word-wrap-setting-test
  (testing "returns false when VS Code is not available"
    (with-redefs [util/vscode (atom nil)]
      (is (false? (sut/get-editor-word-wrap-setting)))))
  (testing "returns false when editor.wordWrap is off"
    (with-redefs [util/vscode (atom (vscode-with-editor-word-wrap-setting "off"))]
      (is (false? (sut/get-editor-word-wrap-setting)))))
  (testing "returns true when editor.wordWrap is not off"
    (with-redefs [util/vscode (atom (vscode-with-editor-word-wrap-setting "on"))]
      (is (true? (sut/get-editor-word-wrap-setting))))))

(deftest word-wrap-context-test
  (testing "sets the output word wrap context"
    (let [execute-command-spy (spy/spy)
          vscode (clj->js {:commands {:executeCommand (test-util/wrap-spy execute-command-spy)}})]
      (with-redefs [util/vscode (atom vscode)]
        (sut/set-word-wrap-context! true)
        (is (spy/called-once-with? execute-command-spy "setContext" "calva:outputWordWrap" true))))))

(deftest get-webview-html-test
  (testing "Given valid args and that the environment is debug, should return the expected html markup"
    (let [result (sut/get-webview-html {:env/is-debug true} {:js-source "js-source"
                                                             :css-href "css-href"
                                                             :csp-source "csp-source"})]
      (is (= 1 (count (re-seq #"js-source" result))))
      (is (= 1 (count (re-seq #"css-href" result))))
      (is (= 3 (count (re-seq #"csp-source" result))))
      (is (re-find #"img-src data: csp-source" result))
      (is (= 1 (count (re-seq #"'unsafe-eval'" result))))
      (is (= 1 (count (re-seq #"connect-src ws://localhost:\*" result))))))
  (testing "Given valid args and that the environment is not debug, should return the expected html markup"
    (let [result (sut/get-webview-html {:env/is-debug false} {:js-source "js-source"
                                                              :css-href "css-href"
                                                              :csp-source "csp-source"})]
      (is (= 1 (count (re-seq #"js-source" result))))
      (is (= 1 (count (re-seq #"css-href" result))))
      (is (= 3 (count (re-seq #"csp-source" result))))
      (is (re-find #"img-src data: csp-source" result))
      (is (zero? (count (re-seq #"'unsafe-eval'" result))))
      (is (zero? (count (re-seq #"connect-src ws://localhost:\*" result))))))
  (testing "Given greeting html, should include it in the output div"
    (is (re-find #"GREETING-MARKER"
                 (sut/get-webview-html {:env/is-debug false}
                                       {:js-source "js-source"
                                        :css-href "css-href"
                                        :csp-source "csp-source"
                                        :greeting-html "GREETING-MARKER"}))))
  (testing "Given word-wrap is enabled, should add the word-wrap body class"
    (is (re-find #"<body class=\"word-wrap\">"
                 (sut/get-webview-html {:env/is-debug false}
                                       {:js-source "js-source"
                                        :css-href "css-href"
                                        :csp-source "csp-source"
                                        :word-wrap? true}))))
  (testing "Given word-wrap is disabled, should not add the word-wrap body class"
    (is (re-find #"<body>"
                 (sut/get-webview-html {:env/is-debug false}
                                       {:js-source "js-source"
                                        :css-href "css-href"
                                        :csp-source "csp-source"
                                        :word-wrap? false}))))
  (testing "Given a font-scale, should set the font scale css variable on the html element"
    (is (re-find #"<html lang=\"en\" style=\"--calva-output-font-scale: 1.25;\">"
                 (sut/get-webview-html {:env/is-debug false}
                                       {:js-source "js-source"
                                        :css-href "css-href"
                                        :csp-source "csp-source"
                                        :font-scale 1.25}))))
  (testing "Given no font-scale, should default the font scale css variable to 1"
    (is (re-find #"<html lang=\"en\" style=\"--calva-output-font-scale: 1;\">"
                 (sut/get-webview-html {:env/is-debug false}
                                       {:js-source "js-source"
                                        :css-href "css-href"
                                        :csp-source "csp-source"})))))

(deftest get-js-source-test
  (testing "Given a context and a webview-panel,"
    (let [join-path-spy (spy/stub "some-path")
          extension-uri "extension-uri"
          context {:vscode/context (clj->js {:extensionUri extension-uri})
                   :vscode/vscode (clj->js {:Uri {:joinPath (test-util/wrap-spy join-path-spy)}})}
          as-webview-uri-spy (spy/stub "some-webview-uri")
          webview-panel (clj->js {:webview {:asWebviewUri (test-util/wrap-spy as-webview-uri-spy)}})
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
                   :vscode/vscode (clj->js {:Uri {:joinPath (test-util/wrap-spy join-path-spy)}})}
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
          ^js webview-panel (clj->js {:webview {:asWebviewUri (test-util/wrap-spy as-webview-uri-spy)
                                                :cspSource "some-csp-source"}})
          get-webview-html-spy (spy/stub "some-html")]
      (with-redefs [sut/get-js-source (test-util/wrap-spy get-js-source-spy)
                    sut/get-css-path (test-util/wrap-spy get-css-path-spy)
                    greeting/logo-webview-uri (constantly "some-logo-href")
                    greeting/html-for-view (constantly "some-greeting")
                    sut/word-wrap? (constantly true)
                    sut/get-output-views-font-scale-setting (constantly 1.5)
                    sut/get-webview-html (test-util/wrap-spy get-webview-html-spy)]
        (sut/set-webview-html! context {:webview-panel webview-panel})
        (testing "should call get-js-source with expected args"
          (is (spy/called-once-with? get-js-source-spy context {:webview-panel webview-panel})))
        (testing "should call get-css-path with expected args"
          (is (spy/called-once-with? get-css-path-spy context)))
        (testing "should call asWebviewUri once for the CSS"
          (is (spy/called-once-with? as-webview-uri-spy "some-css-path")))
        (testing "should call get-webview-html with expected args"
          (is (spy/called-once-with? get-webview-html-spy context {:js-source "some-js-source"
                                                                   :css-href "some-css-href"
                                                                   :csp-source "some-csp-source"
                                                                   :code-theme nil
                                                                   :greeting-html "some-greeting"
                                                                   :word-wrap? true
                                                                   :font-scale 1.5})))
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
          (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:Dark color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :code-theme "dark"})))))
      (testing "when the ColorThemeKind is Light, should set the code theme to light"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:Light color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :code-theme "light"})))))
      (testing "when the ColorThemeKind is HighContrast, should set the code theme to high-contrast"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:HighContrast color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :code-theme "high-contrast"})))))
      (testing "when the ColorThemeKind is HighContrastLight, should set the code theme to high-contrast-light"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:HighContrastLight color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :code-theme "high-contrast-light"})))))
      (testing "when there is no configured code theme for the ColorThemeKind, should log the expected error"
        (let [log-to-console-spy (spy/spy)
              color-theme-kind 99]
          (with-redefs [util/log-to-console (test-util/wrap-spy log-to-console-spy)]
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
                                                     (test-util/wrap-spy on-did-change-active-color-theme-spy)}})}]
      (sut/create-color-theme-change-listener context {:webview-panel {:some "webview-panel"}})
      (let [calls (spy/calls on-did-change-active-color-theme-spy)]
        (is (= 1 (count calls)))
        (is (fn? (type (ffirst calls))))))))

(deftest create-view-state-change-listener-test
  (testing "Given a context and a webview panel, should call onDidChangeViewState and pass it a function"
    (let [on-did-change-view-state-spy (spy/spy)
          webview-panel-stub #js {:onDidChangeViewState (test-util/wrap-spy on-did-change-view-state-spy)}]
      (sut/create-view-state-change-listener {} {:webview-panel webview-panel-stub})
      (let [calls (spy/calls on-did-change-view-state-spy)]
        (is (= 1 (count calls)))
        (is (fn? (type (ffirst calls))))))))

(deftest initialize-webview-panel-test
  (testing "Given a context and a webview panel,"
    (let [on-did-dispose-spy (spy/spy)
          stub-webview-panel (clj->js {:onDidDispose (test-util/wrap-spy on-did-dispose-spy)})
          set-webview-html-spy (spy/spy)
          add-subscriptions-spy (spy/spy)
          register-webview!-spy (spy/spy)
          post-message-to-webview-spy (spy/spy)
          context {:some "context"}]
      (with-redefs [sut/set-webview-html! (test-util/wrap-spy set-webview-html-spy)
                    sut/add-subscriptions! (test-util/wrap-spy add-subscriptions-spy)
                    sut/register-webview! (test-util/wrap-spy register-webview!-spy)
                    sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
        (sut/initialize-webview-panel context stub-webview-panel)
        (testing "should register the webview panel"
          (is (spy/called-once-with? register-webview!-spy stub-webview-panel)))
        (testing "should call onDidDispose with expected args"
          (let [calls (spy/calls on-did-dispose-spy)]
            (is (match? [(list fn?)] calls))))
        (testing "should call set-webview-html! with expected args"
          (is (spy/called-once-with? set-webview-html-spy context {:webview-panel stub-webview-panel})))
        (testing "should call add-subscriptions! with expected args"
          (is (spy/called-once-with? add-subscriptions-spy context {:webview-panel stub-webview-panel})))))))

(deftest create-repl-output-webview-panel-test
  (testing "Given a context,"
    (let [on-did-dispose-spy (spy/stub "dispose-subscription")
          stub-webview-panel (clj->js {:onDidDispose (test-util/wrap-spy on-did-dispose-spy)})
          create-webview-panel-spy (spy/stub stub-webview-panel)
          context {:vscode/vscode (clj->js {:window {:createWebviewPanel
                                                     (test-util/wrap-spy create-webview-panel-spy)}
                                            :ViewColumn {:Beside 1}})}
          set-webview-html-spy (spy/spy)
          add-subscriptions-spy (spy/spy)
          initialize-webview-panel-spy (spy/spy)]
      (with-redefs [sut/set-webview-html! (test-util/wrap-spy set-webview-html-spy)
                    sut/add-subscriptions! (test-util/wrap-spy add-subscriptions-spy)
                    sut/initialize-webview-panel (test-util/wrap-spy initialize-webview-panel-spy)]
        (let [result (sut/create-repl-output-webview-panel context)]
          (testing "should call createWebviewPanel with expected args"
            (let [calls (spy/calls create-webview-panel-spy)]
              (is (= 1 (count calls)))
              (is (= '[("calva.output-view"
                        "REPL Output"
                        {:preserveFocus true, :viewColumn 1}
                        {:enableScripts true
                         :enableCommandUris ["calva.showReplOutputView"]
                         :retainContextWhenHidden true
                         :enableFindWidget true})]
                     (js->clj calls :keywordize-keys true)))))
          (testing "should call initialize-webview-panel with expected args"
            (is (spy/called-once-with? initialize-webview-panel-spy context stub-webview-panel)))
          (testing "should return the webview panel"
            (is (= stub-webview-panel result))))))))

(deftest show-repl-output-webview-panel-test
  (testing "When the webview panel does not exist,"
    (let [reveal-spy (spy/spy)
          set-code-theme!-spy (spy/spy)
          webview-panel-stub (clj->js {:reveal (test-util/wrap-spy reveal-spy)})
          create-repl-output-webview-panel-spy (spy/stub webview-panel-stub)
          color-theme-kind 1
          vscode-stub (clj->js {:window {:activeColorTheme {:kind color-theme-kind}}})
          vscode-context-stub "stub-vscode-context"
          expected-context {:env/is-debug false
                            :vscode/vscode vscode-stub
                            :vscode/context vscode-context-stub}
          expected-theme-args {:color-theme-kind color-theme-kind
                               :webview-panel webview-panel-stub}]
      (with-redefs [util/env {:is-debug false}
                    util/vscode (atom vscode-stub)
                    util/vscode-context (atom vscode-context-stub)
                    sut/output-view-webview-panel (atom nil)
                    sut/create-repl-output-webview-panel (test-util/wrap-spy create-repl-output-webview-panel-spy)
                    sut/set-code-theme! (test-util/wrap-spy set-code-theme!-spy)]
        (sut/show-repl-output-webview-panel true)
        (testing "Should call create-repl-output-webview-panel with expected args"
          (is (spy/called-once-with? create-repl-output-webview-panel-spy expected-context)))
        (testing "Should set repl-output-webview-panel to the result of create-repl-output-webview-panel"
          (is (= webview-panel-stub @sut/output-view-webview-panel)))
        (testing "Should call reveal on webview panel with expected args"
          (is (spy/called-once-with? reveal-spy nil true)))
        (testing "Should call set-code-theme! when creating and revealing the webview panel"
          (let [calls (spy/calls set-code-theme!-spy)]
            (is (= 2 (count calls)))
            (is (every? #(= expected-context (first %)) calls))
            (is (every? #(= expected-theme-args (second %)) calls)))))))
  (testing "When the webview panel already exists,"
    (let [reveal-spy (spy/spy)
          set-code-theme!-spy (spy/spy)
          webview-panel-stub (clj->js {:reveal (test-util/wrap-spy reveal-spy)})
          create-repl-output-webview-panel-spy (spy/spy)
          color-theme-kind 1
          vscode-stub (clj->js {:window {:activeColorTheme {:kind color-theme-kind}}})
          vscode-context-stub "stub-vscode-context"
          expected-context {:env/is-debug false
                            :vscode/vscode vscode-stub
                            :vscode/context vscode-context-stub}
          expected-theme-args {:color-theme-kind color-theme-kind
                               :webview-panel webview-panel-stub}]
      (with-redefs [util/env {:is-debug false}
                    util/vscode (atom vscode-stub)
                    util/vscode-context (atom vscode-context-stub)
                    sut/output-view-webview-panel (atom webview-panel-stub)
                    sut/create-repl-output-webview-panel (test-util/wrap-spy create-repl-output-webview-panel-spy)
                    sut/set-code-theme! (test-util/wrap-spy set-code-theme!-spy)]
        (sut/show-repl-output-webview-panel false)
        (testing "should not call create-repl-output-webview-panel"
          (is (spy/not-called? create-repl-output-webview-panel-spy)))
        (testing "and false is passed for preserve-focus? arg, should call reveal on webview panel with expected args"
          (is (spy/called-once-with? reveal-spy nil false)))
        (testing "should call set-code-theme! with expected args"
          (is (spy/called-once-with? set-code-theme!-spy expected-context expected-theme-args)))))))

(deftest options->meta-test
  (testing "Given nil options, should return nil"
    (is (nil? (sut/options->meta nil))))
  (testing "Given a map of options with only :who, should return a map with only :meta/who"
    (is (= {:meta/who "repl"}
           (sut/options->meta {:who "repl"}))))
  (testing "Given a map of options with all supported keys, should return the expected map"
    (is (= {:meta/who "repl"
            :meta/ns "user"
            :meta/repl-session-key "clj"
            :meta/shadow-build "app"
            :meta/shadow-runtime-id 1}
           (sut/options->meta {:who "repl"
                               :ns "user"
                               :replSessionKey "clj"
                               :shadowBuild "app"
                               :shadowRuntimeId 1}))))
  (testing "Given a JS object with all supported keys, should return the expected map"
    (is (= {:meta/who "repl"
            :meta/ns "user"
            :meta/repl-session-key "clj"
            :meta/shadow-build "app"
            :meta/shadow-runtime-id 1}
           (sut/options->meta (clj->js {:who "repl"
                                        :ns "user"
                                        :replSessionKey "clj"
                                        :shadowBuild "app"
                                        :shadowRuntimeId 1})))))
  (testing "Given options with no recognized keys, should return an empty map"
    (is (= {} (sut/options->meta {:outputCategory "evalOut"}))))
  (testing "Given options with shadow-runtime-id 0, should include it"
    (is (= {:meta/shadow-runtime-id 0}
           (sut/options->meta {:shadowRuntimeId 0})))))

(deftest append-test
  (testing "Given options and a message,"
    (testing "when command exists for output category, should call post-message-to-webview with expected args"
      (let [options (clj->js {:outputCategory "evalOut"})
            message "some-message"
            post-message-to-webview-spy (spy/spy)]
        (with-redefs [sut/output-category->command-name {"evalOut" "show-stdout"}
                      sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)
                      sut/output-view-webview-panel (atom "webview-panel-stub")]
          (sut/append options message)
          (is (spy/called-once-with? post-message-to-webview-spy
                                     "webview-panel-stub"
                                     {:command/name "show-stdout"
                                      :output-category "evalOut"
                                      :output message})))))
    (testing "when options carry metadata, should include :meta in the posted message"
      (let [options (clj->js {:outputCategory "evalOut"
                              :who "repl"
                              :ns "user"
                              :replSessionKey "clj"})
            message "some-message"
            post-message-to-webview-spy (spy/spy)]
        (with-redefs [sut/output-category->command-name {"evalOut" "show-stdout"}
                      sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)
                      sut/output-view-webview-panel (atom "webview-panel-stub")]
          (sut/append options message)
          (is (spy/called-once-with? post-message-to-webview-spy
                                     "webview-panel-stub"
                                     {:command/name "show-stdout"
                                      :output-category "evalOut"
                                      :output message
                                      :meta {:meta/who "repl"
                                             :meta/ns "user"
                                             :meta/repl-session-key "clj"}})))))
    (testing "when the webview panel does not exist, should create it before posting"
      (let [options (clj->js {:outputCategory "evalOut"})
            create-repl-output-webview-panel-spy (spy/stub "created-webview-panel")
            set-code-theme!-spy (spy/spy)
            post-message-to-webview-spy (spy/spy)
            vscode-stub (clj->js {:window {:activeColorTheme {:kind 1}}})]
        (with-redefs [sut/output-category->command-name {"evalOut" "show-stdout"}
                      util/vscode (atom vscode-stub)
                      util/vscode-context (atom "vscode-context")
                      sut/output-view-webview-panel (atom nil)
                      sut/create-repl-output-webview-panel (test-util/wrap-spy create-repl-output-webview-panel-spy)
                      sut/set-code-theme! (test-util/wrap-spy set-code-theme!-spy)
                      sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
          (sut/append options "some-message")
          (is (spy/called-once-with? create-repl-output-webview-panel-spy
                                     {:env/is-debug (:is-debug util/env)
                                      :vscode/vscode vscode-stub
                                      :vscode/context "vscode-context"}))
          (is (spy/called-once-with? post-message-to-webview-spy
                                     "created-webview-panel"
                                     {:command/name "show-stdout"
                                      :output-category "evalOut"
                                      :output "some-message"})))))
    (testing "when command does not exist for output category,"
      (let [options (clj->js {:outputCategory "nonexistent-category"})
            message "some-message"
            post-message-to-webview-spy (spy/spy)
            log-to-console-spy (spy/spy)]
        (with-redefs [sut/output-category->command-name {"evalOut" "show-stdout"}
                      sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)
                      sut/output-view-webview-panel (atom "webview-panel-stub")
                      util/log-to-console (test-util/wrap-spy log-to-console-spy)]
          (sut/append options message)
          (is (spy/not-called? post-message-to-webview-spy))
          (is (spy/called-once-with?
               log-to-console-spy
               :error
               "Cannot append output to output webview. No outputCategory matches \"nonexistent-category\"")))))))

(deftest stacktrace->message-test
  (testing "Given a stacktrace with no duplicate flags and no classes to ignore, should return the expected message"
    (let [stacktrace [{:class "clojure.lang.Numbers",
                       :file "Numbers.java",
                       :file-url [],
                       :flags ["java"],
                       :line 190,
                       :method "divide",
                       :name "clojure.lang.Numbers/divide",
                       :type "java"}
                      {:fn "eval12684",
                       :method "invokeStatic",
                       :ns "core",
                       :name "core$eval12684/invokeStatic",
                       :file "NO_SOURCE_FILE",
                       :type "clj",
                       :file-url "",
                       :line 99,
                       :var "core/eval12684",
                       :class "core$eval12684",
                       :flags ["project" "repl" "clj"]}]]
      (with-redefs [sut/stacktrace-classes-to-ignore #{}]
        (is (= "clojure.lang.Numbers/divide (Numbers.java:190)\ncore/eval12684 (NO_SOURCE_FILE:99)"
               (sut/stacktrace->message stacktrace))))))
  (testing "Given a stacktrace with duplicate flags and classes to ignore,"
    (let [stacktrace [{:class "some-class-to-ignore",
                       :file "Numbers.java",
                       :file-url [],
                       :flags ["java"],
                       :line 190,
                       :method "divide",
                       :name "frame-with-class-to-ignore",
                       :type "java"}
                      {:class "clojure.lang.Numbers",
                       :file "Numbers.java",
                       :file-url [],
                       :flags ["dup" "java"],
                       :line 3915,
                       :method "divide",
                       :name "duplicate-frame",
                       :type "java"}
                      {:fn "eval12684",
                       :method "invokeStatic",
                       :ns "core",
                       :name "core$eval12684/invokeStatic",
                       :file "NO_SOURCE_FILE",
                       :type "clj",
                       :file-url "",
                       :line 99,
                       :var "core/eval12684",
                       :class "core$eval12684",
                       :flags ["project" "repl" "clj"]}]]
      (with-redefs [sut/stacktrace-classes-to-ignore #{"some-class-to-ignore"}]
        (testing "should return a message with no stacktrace frames that include duplicate flags or classes to ignore"
          (is (= "core/eval12684 (NO_SOURCE_FILE:99)" (sut/stacktrace->message stacktrace)))))))
  (testing "Given a stacktrace, should return entries separated by newline characters"
    (with-redefs [sut/stacktrace-entry->string (constantly "some-entry")]
      (is (= "some-entry\nsome-entry\nsome-entry"
             ;; We redefed stacktrace-entry->string to always return "some-entry", so the stacktrace data doesn't
             ;; matter here, aside from the number of entries.
             (sut/stacktrace->message ["entry1" "entry2" "entry3"]))))))

(deftest append-stacktrace-test
  (testing "Given a JS stacktrace,"
    (let [stacktrace->message-spy (spy/stub "some-message")
          post-message-to-webview-spy (spy/spy)
          clj-stacktrace [{:class "clojure.lang.Numbers",
                           :file "Numbers.java"}
                          {:file "NO_SOURCE_FILE",
                           :class "core$eval12684"}]
          js-stacktrace (clj->js clj-stacktrace)]
      (with-redefs [sut/stacktrace->message (test-util/wrap-spy stacktrace->message-spy)
                    sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)
                    sut/output-view-webview-panel (atom "webview-panel-stub")]
        (sut/append-stacktrace js-stacktrace)
        (is (spy/called-once-with? stacktrace->message-spy clj-stacktrace))
        (is (spy/called-once-with? post-message-to-webview-spy
                                   "webview-panel-stub"
                                   {:command/name "show-stdout"
                                    :output-category "evalErr"
                                    :output "some-message"})))))
  (testing "when the webview panel does not exist, should create it before posting"
    (let [create-repl-output-webview-panel-spy (spy/stub "created-webview-panel")
          set-code-theme!-spy (spy/spy)
          post-message-to-webview-spy (spy/spy)
          vscode-stub (clj->js {:window {:activeColorTheme {:kind 1}}})]
      (with-redefs [util/vscode (atom vscode-stub)
                    util/vscode-context (atom "vscode-context")
                    sut/output-view-webview-panel (atom nil)
                    sut/create-repl-output-webview-panel (test-util/wrap-spy create-repl-output-webview-panel-spy)
                    sut/set-code-theme! (test-util/wrap-spy set-code-theme!-spy)
                    sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
        (sut/append-stacktrace (clj->js []))
        (is (spy/called-once-with? create-repl-output-webview-panel-spy
                                   {:env/is-debug (:is-debug util/env)
                                    :vscode/vscode vscode-stub
                                    :vscode/context "vscode-context"}))
        (is (spy/called-once-with? post-message-to-webview-spy
                                   "created-webview-panel"
                                   {:command/name "show-stdout"
                                    :output-category "evalErr"
                                    :output ""}))))))

(deftest clear-output-view-test
  (testing "Should call post-message-to-webview with expected args"
    (let [post-message-to-webview-spy (spy/spy)
          output-view-webview-panel (atom "webview-panel-stub")]
      (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)
                    sut/output-view-webview-panel output-view-webview-panel]
        (sut/clear-output-view)
        (is (spy/called-once-with? post-message-to-webview-spy
                                   "webview-panel-stub"
                                   {:command/name "clear-output-view"})))))
  (testing "when the webview panel does not exist, should not create, show, or post"
    (let [create-repl-output-webview-panel-spy (spy/spy)
          show-repl-output-webview-panel-spy (spy/spy)
          post-message-to-webview-spy (spy/spy)
          output-view-webview-panel (atom nil)]
      (with-redefs [sut/output-view-webview-panel output-view-webview-panel
                    sut/create-repl-output-webview-panel (test-util/wrap-spy create-repl-output-webview-panel-spy)
                    sut/show-repl-output-webview-panel (test-util/wrap-spy show-repl-output-webview-panel-spy)
                    sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
        (sut/clear-output-view)
        (is (nil? @output-view-webview-panel))
        (is (spy/not-called? create-repl-output-webview-panel-spy))
        (is (spy/not-called? show-repl-output-webview-panel-spy))
        (is (spy/not-called? post-message-to-webview-spy))))))

#_(run-tests)

(defn vscode-with-font-scale-setting
  [setting]
  #js {:workspace #js {:getConfiguration (fn [_section] #js {:get (fn [_setting] setting)})}})

(deftest get-output-views-font-scale-setting-test
  (testing "returns 1.0 when VS Code is not available"
    (with-redefs [util/vscode (atom nil)]
      (is (= 1.0 (sut/get-output-views-font-scale-setting)))))
  (testing "returns the configured setting when it is a number"
    (with-redefs [util/vscode (atom (vscode-with-font-scale-setting 1.5))]
      (is (= 1.5 (sut/get-output-views-font-scale-setting)))))
  (testing "returns 1.0 when the configured setting is not a number"
    (with-redefs [util/vscode (atom (vscode-with-font-scale-setting nil))]
      (is (= 1.0 (sut/get-output-views-font-scale-setting))))))

(deftest increase-font-size-test
  (testing "posts an adjust-font-size message with a positive delta to all registered webviews"
    (let [post-message-to-webview-spy (spy/spy)
          webview-a #js {}
          webview-b #js {}]
      (with-redefs [sut/registered-webviews (atom #{webview-a webview-b})
                    sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
        (sut/increase-font-size)
        (let [calls (spy/calls post-message-to-webview-spy)]
          (is (= 2 (count calls)))
          (is (every? #(= {:command/name "adjust-font-size" :delta 0.1} (second %)) calls)))))))

(deftest decrease-font-size-test
  (testing "posts an adjust-font-size message with a negative delta to all registered webviews"
    (let [post-message-to-webview-spy (spy/spy)
          webview-a #js {}]
      (with-redefs [sut/registered-webviews (atom #{webview-a})
                    sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
        (sut/decrease-font-size)
        (is (spy/called-once-with? post-message-to-webview-spy webview-a {:command/name "adjust-font-size" :delta -0.1}))))))

(deftest reset-font-size-test
  (testing "posts a reset-font-size message to all registered webviews"
    (let [post-message-to-webview-spy (spy/spy)
          webview-a #js {}]
      (with-redefs [sut/registered-webviews (atom #{webview-a})
                    sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
        (sut/reset-font-size)
        (is (spy/called-once-with? post-message-to-webview-spy webview-a {:command/name "reset-font-size"}))))))

(deftest init-font-size-scale!-test
  (testing "registers a configuration change listener as a subscription"
    (let [push-spy (spy/spy)
          vscode-context-stub #js {:subscriptions #js {:push (test-util/wrap-spy push-spy)}}]
      (with-redefs [util/vscode-context (atom vscode-context-stub)
                    sut/create-font-scale-change-listener (constantly "some-listener")]
        (sut/init-font-size-scale!)
        (is (spy/called-once-with? push-spy "some-listener")))))
  (testing "does nothing when there is no vscode-context"
    (let [push-spy (spy/spy)]
      (with-redefs [util/vscode-context (atom nil)
                    sut/create-font-scale-change-listener (test-util/wrap-spy push-spy)]
        (sut/init-font-size-scale!)
        (is (spy/not-called? push-spy))))))
