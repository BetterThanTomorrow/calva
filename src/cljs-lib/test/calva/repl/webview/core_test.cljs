(ns calva.repl.webview.core-test
  (:require
   [calva.repl.webview.core :as sut]
   [cljs.reader :as reader]
   [cljs.test :refer-macros [deftest testing is run-tests]]
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
                    sut/get-webview-html (test-util/wrap-spy get-webview-html-spy)]
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
          (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:Dark color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :content "dark"})))))
      (testing "when the ColorThemeKind is Light, should set the code theme to light"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:Light color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :content "light"})))))
      (testing "when the ColorThemeKind is HighContrast, should set the code theme to high-contrast"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:HighContrast color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :content "high-contrast"})))))
      (testing "when the ColorThemeKind is HighContrastLight, should set the code theme to high-contrast-light"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:HighContrastLight color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :content "high-contrast-light"})))))
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

(deftest create-repl-output-webview-panel-test
  (testing "Given a context,"
    (let [on-did-dispose-spy (spy/spy)
          stub-webview-panel (clj->js {:onDidDispose (test-util/wrap-spy on-did-dispose-spy)})
          create-webview-panel-spy (spy/stub stub-webview-panel)
          context {:vscode/vscode (clj->js {:window {:createWebviewPanel
                                                     (test-util/wrap-spy create-webview-panel-spy)}
                                            :ViewColumn {:Beside 1}})}
          set-webview-html-spy (spy/spy)
          add-subscriptions-spy (spy/spy)]
      (with-redefs [sut/set-webview-html! (test-util/wrap-spy set-webview-html-spy)
                    sut/add-subscriptions! (test-util/wrap-spy add-subscriptions-spy)]
        (let [result (sut/create-repl-output-webview-panel context)]
          (testing "should call createWebviewPanel with expacted args"
            (let [calls (spy/calls create-webview-panel-spy)]
              (is (= 1 (count calls)))
              (is (= '[("calva:repl-output"
                        "REPL Output"
                        {:preserveFocus true, :viewColumn 1}
                        {:enableScripts true, :retainContextWhenHidden true, :enableFindWidget true})]
                     (js->clj calls :keywordize-keys true)))))
          (testing "should call onDidDispose with expected args"
            (let [calls (spy/calls on-did-dispose-spy)]
              (is (= 1 (count calls)))
              (is (match? [(list fn?)] calls))))
          (testing "should call set-webview-html! with expected args"
            (is (spy/called-once-with? set-webview-html-spy context {:webview-panel stub-webview-panel})))
          (testing "should call add-subscriptions! with expected args"
            (is (spy/called-once-with? add-subscriptions-spy context {:webview-panel stub-webview-panel})))
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
                            :vscode/context vscode-context-stub}]
      (with-redefs [util/env {:is-debug false}
                    util/vscode (atom vscode-stub)
                    util/vscode-context (atom vscode-context-stub)
                    sut/repl-output-webview-panel (atom nil)
                    sut/create-repl-output-webview-panel (test-util/wrap-spy create-repl-output-webview-panel-spy)
                    sut/set-code-theme! (test-util/wrap-spy set-code-theme!-spy)]
        (sut/show-repl-output-webview-panel)
        (testing "Should call create-repl-output-webview-panel with expected args"
          (is (spy/called-once-with? create-repl-output-webview-panel-spy expected-context)))
        (testing "Should set repl-output-webview-panel to the result of create-repl-output-webview-panel"
          (is (= webview-panel-stub @sut/repl-output-webview-panel)))
        (testing "Should call reveal on webview panel with expected args"
          (is (spy/called-once-with? reveal-spy nil true)))
        (testing "Should call set-code-theme! with expected args"
          (is (spy/called-once-with? set-code-theme!-spy expected-context {:color-theme-kind color-theme-kind
                                                                           :webview-panel webview-panel-stub}))))))
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
                            :vscode/context vscode-context-stub}]
      (with-redefs [util/env {:is-debug false}
                    util/vscode (atom vscode-stub)
                    util/vscode-context (atom vscode-context-stub)
                    sut/repl-output-webview-panel (atom webview-panel-stub)
                    sut/create-repl-output-webview-panel (test-util/wrap-spy create-repl-output-webview-panel-spy)
                    sut/set-code-theme! (test-util/wrap-spy set-code-theme!-spy)]
        (sut/show-repl-output-webview-panel)
        (testing "should not call create-repl-output-webview-panel"
          (is (spy/not-called? create-repl-output-webview-panel-spy)))
        (testing "should call reveal on webview panel with expected args"
          (is (spy/called-once-with? reveal-spy nil true)))
        (testing "should call set-code-theme! with expected args"
          (is (spy/called-once-with? set-code-theme!-spy expected-context {:color-theme-kind color-theme-kind
                                                                           :webview-panel webview-panel-stub})))))))

(deftest append-test
  (testing "Given options and a message,"
    (testing "when command exists for output category, should call post-message-to-webview with expected args"
      (let [options (clj->js {:outputCategory "evalOut"})
            message "some-message"
            post-message-to-webview-spy (spy/spy)]
        (with-redefs [sut/output-category->command-name {"evalOut" "show-stdout"}
                      sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)
                      sut/repl-output-webview-panel (atom "webview-panel-stub")]
          (sut/append options message)
          (is (spy/called-once-with? post-message-to-webview-spy
                                     "webview-panel-stub"
                                     {:command/name "show-stdout"
                                      :content message})))))
    (testing "when command does not exist for output category,"
      (let [options (clj->js {:outputCategory "nonexistent-category"})
            message "some-message"
            post-message-to-webview-spy (spy/spy)
            log-to-console-spy (spy/spy)]
        (with-redefs [sut/output-category->command-name {"evalOut" "show-stdout"}
                      sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)
                      sut/repl-output-webview-panel (atom "webview-panel-stub")
                      util/log-to-console (test-util/wrap-spy log-to-console-spy)]
          (sut/append options message)
          (testing "should not call post-message-to-webview"
            (is (spy/not-called? post-message-to-webview-spy)))
          (testing "should log expected error"
            (is (spy/called-once-with?
                 log-to-console-spy
                 :error
                 "Cannot append content to output webview. No outputCategory matches \"nonexistent-category\""))))))))

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
                    sut/repl-output-webview-panel (atom "webview-panel-stub")]
        (sut/append-stacktrace js-stacktrace)
        (testing "should call stacktrace->message with clj stacktrace"
          (is (spy/called-once-with? stacktrace->message-spy clj-stacktrace)))
        (testing "should call post-message-to-webview with expected args"
          (is (spy/called-once-with? post-message-to-webview-spy
                                     "webview-panel-stub"
                                     {:command/name "show-stdout"
                                      :content "some-message"})))))))

#_(run-tests)
