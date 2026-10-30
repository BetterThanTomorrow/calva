(ns calva.repl.webview.core-test
  (:require
   [calva.repl.input.host :as input-host]
   [calva.repl.webview.core :as sut]
   [calva.repl.webview.greeting :as greeting]
   [calva.repl.webview.styles :as styles]
   [calva.repl.webview.token-colors :as token-colors]
   [cljs.reader :as reader]
   [cljs.test :refer-macros [deftest testing is]]
   [clojure.string :as string]
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

(defn vscode-with-output-views-word-wrap-setting
  [setting]
  #js {:workspace #js {:getConfiguration (fn [_section] #js {:get (fn [_setting] setting)})}})

(deftest get-output-views-word-wrap-setting-test
  (testing "returns true when setting is \"on\""
    (with-redefs [util/vscode (atom (vscode-with-output-views-word-wrap-setting "on"))]
      (is (true? (sut/get-output-views-word-wrap-setting)))))
  (testing "returns false when setting is \"off\""
    (with-redefs [util/vscode (atom (vscode-with-output-views-word-wrap-setting "off"))]
      (is (false? (sut/get-output-views-word-wrap-setting)))))
  (testing "follows the editor word wrap setting when setting is \"follow-editor\""
    (with-redefs [util/vscode (atom (vscode-with-output-views-word-wrap-setting "follow-editor"))
                  sut/get-editor-word-wrap-setting (constantly true)]
      (is (true? (sut/get-output-views-word-wrap-setting)))))
  (testing "follows the editor word wrap setting when the setting is not present"
    (with-redefs [util/vscode (atom (vscode-with-output-views-word-wrap-setting nil))
                  sut/get-editor-word-wrap-setting (constantly true)]
      (is (true? (sut/get-output-views-word-wrap-setting)))))
  (testing "returns false when VS Code is not available"
    (with-redefs [util/vscode (atom nil)]
      (is (false? (sut/get-output-views-word-wrap-setting))))))

(deftest word-wrap-test
  (testing "uses get-output-views-word-wrap-setting when there is no override"
    (with-redefs [sut/word-wrap-override (atom nil)
                  sut/get-output-views-word-wrap-setting (constantly true)]
      (is (true? (sut/word-wrap?)))))
  (testing "uses override when present"
    (with-redefs [sut/word-wrap-override (atom false)
                  sut/get-output-views-word-wrap-setting (constantly true)]
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

(defn- elements
  "Returns the elements of `hiccup` with `tag`, in document order."
  [hiccup tag]
  (->> (tree-seq #(or (vector? %) (seq? %)) #(if (vector? %) (remove map? (rest %)) %) hiccup)
       (filter #(and (vector? %) (= tag (first %))))))

(defn- attributes
  [[_ attrs]]
  (when (map? attrs) attrs))

(defn- content-security-policy
  [page]
  (some #(when (= "Content-Security-Policy" (:http-equiv (attributes %)))
           (:content (attributes %)))
        (elements page :meta)))

(def ^:private page-args
  {:js-source "js-source"
   :styles "styles-css"
   :csp-source "csp-source"
   :script-nonce "test-nonce"})

(deftest page-test
  (testing "in development, allows what the shadow-cljs devtools need"
    (let [policy (content-security-policy (sut/page {:env/is-debug true} page-args))]
      (is (string/includes? policy "script-src 'unsafe-eval' 'nonce-test-nonce';"))
      (is (string/includes? policy "connect-src ws://localhost:*;"))))
  (testing "outside development, allows the page's own script, styles and images"
    (let [policy (content-security-policy (sut/page {:env/is-debug false} page-args))]
      (is (string/includes? policy "default-src 'none';"))
      (is (string/includes? policy "img-src data: https: http: csp-source;"))
      (is (string/includes? policy "style-src csp-source 'nonce-test-nonce';"))
      (is (string/includes? policy "script-src 'nonce-test-nonce';"))
      (is (not (string/includes? policy "unsafe-eval")))
      (is (not (string/includes? policy "connect-src")))))
  (testing "the script and the styles carry the nonce"
    (let [page (sut/page {:env/is-debug false} page-args)]
      (is (= [[:script {:nonce "test-nonce" :src "js-source"}]] (elements page :script)))
      (is (= [[:style {:id "calva-output-styles" :nonce "test-nonce" :innerHTML "styles-css"}]]
             (elements page :style)))))
  (testing "writes the script's and the stylesheets' URIs, which VS Code gives as Uri objects, as strings"
    (let [uri (fn [s] #js {:toString (constantly s)})
          page (sut/page {:env/is-debug false}
                         (assoc page-args
                                :js-source (uri "js-uri")
                                :code-theme-stylesheets [["dark" (uri "dark-uri")]]
                                :copy-button-css-href (uri "copy-uri")))]
      (is (= "js-uri" (:src (attributes (first (elements page :script))))))
      (is (= ["dark-uri" "copy-uri"] (map (comp :href attributes) (elements page :link))))))
  (testing "the greeting comes before the output, not inside it"
    (let [[_ _ & children] (first (elements (sut/page {:env/is-debug false}
                                                      (assoc page-args :greeting [:div "Ahoy"]))
                                            :body))]
      (is (= [[:div "Ahoy"] [:div {:id "output" :class "output-element-container"}]]
             (take 2 children)))))
  (testing "the body has the word-wrap class only with word wrap on"
    (is (= "word-wrap" (:class (attributes (first (elements (sut/page {:env/is-debug false} (assoc page-args :word-wrap? true)) :body))))))
    (is (nil? (:class (attributes (first (elements (sut/page {:env/is-debug false} (assoc page-args :word-wrap? false)) :body)))))))
  (testing "the body has the image display, images when none is given"
    (is (= "raw" (:data-image-display (attributes (first (elements (sut/page {:env/is-debug false} (assoc page-args :image-display "raw")) :body))))))
    (is (= "images" (:data-image-display (attributes (first (elements (sut/page {:env/is-debug false} page-args) :body)))))))
  (testing "the html element has the font scale, 1 when none is given"
    (is (= {:--calva-output-font-scale "1.25"}
           (:style (attributes (sut/page {:env/is-debug false} (assoc page-args :font-scale 1.25))))))
    (is (= {:--calva-output-font-scale "1"}
           (:style (attributes (sut/page {:env/is-debug false} page-args)))))))

(deftest page-stylesheets-test
  (let [links (elements (sut/page {:env/is-debug false}
                                  (assoc page-args
                                         :code-theme "light"
                                         :code-theme-stylesheets [["dark" "dark-href"] ["light" "light-href"]]
                                         :copy-button-css-href "copy-href"))
                        :link)]
    (is (= [[:link {:rel "stylesheet" :href "dark-href" :data-code-theme "dark" :disabled true}]
            [:link {:rel "stylesheet" :href "light-href" :data-code-theme "light" :disabled false}]
            [:link {:rel "stylesheet" :href "copy-href"}]]
           links)
        "The code theme stylesheets of other theme kinds are disabled, and only the vendored stylesheets are linked")))

(deftest page-repl-input-test
  (testing "puts the REPL Input element after the output, with its state"
    (let [[_ _ & children] (first (elements (sut/page {:env/is-debug false}
                                                      (assoc page-args :repl-input {:repl-input/id "output-view"
                                                                                    :repl-input/enabled? true}))
                                            :body))]
      (is (= [[:div {:id "output" :class "output-element-container"}]
              [:div {:id "repl-input" :data-repl-input-id "output-view" :data-repl-input-enabled "true"}]]
             (take 2 (remove nil? children))))))
  (testing "puts no REPL Input element without REPL Input state"
    (is (empty? (filter #(= "repl-input" (:id (attributes %)))
                        (elements (sut/page {:env/is-debug false} page-args) :div))))))

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
          result (sut/get-css-path context ["vendor" "highlightjs-copy.min.css"])]
      (testing "should call joinPath with expected args"
        (is (spy/called-once-with? join-path-spy extension-uri "repl-output-ui" "css" "vendor" "highlightjs-copy.min.css")))
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
          page-spy (spy/stub [:html {:lang "en"}])
          fixed-nonce "11111111-1111-1111-1111-111111111111"
          crypto-mod (js/require "crypto")
          orig-random-uuid (.-randomUUID crypto-mod)]
      (set! (.-randomUUID crypto-mod) (fn [] fixed-nonce))
      (try
        (with-redefs [sut/get-js-source (test-util/wrap-spy get-js-source-spy)
                      sut/get-css-path (test-util/wrap-spy get-css-path-spy)
                      greeting/logo-webview-uri (constantly "some-logo-href")
                      greeting/for-view (constantly [:div "some-greeting"])
                      sut/word-wrap? (constantly true)
                      sut/get-output-views-font-scale-setting (constantly 1.5)
                      sut/image-display (constantly "raw")
                      styles/css (constantly "some-styles")
                      input-host/html-state (fn [view-id] {:repl-input/id view-id})
                      sut/page (test-util/wrap-spy page-spy)]
          (sut/set-webview-html! context {:webview-panel webview-panel})
          (testing "should call get-js-source with expected args"
            (is (spy/called-once-with? get-js-source-spy context {:webview-panel webview-panel})))
          (testing "should call get-css-path for each stylesheet shipped with the extension"
            (is (spy/called-with? get-css-path-spy context ["vendor" "highlight.js" "github-dark.min.css"]))
            (is (spy/called-with? get-css-path-spy context sut/copy-button-stylesheet))
            (is (= 5 (spy/call-count as-webview-uri-spy)) "One webview uri per stylesheet"))
          (testing "should call page with expected args including a script nonce"
            (is (spy/called-once-with? page-spy context {:js-source "some-js-source"
                                                         :styles "some-styles"
                                                         :code-theme-stylesheets (mapv (fn [[theme]] [theme "some-css-href"])
                                                                                       sut/highlight-js-code-theme-stylesheet-data)
                                                         :copy-button-css-href "some-css-href"
                                                         :csp-source "some-csp-source"
                                                         :script-nonce fixed-nonce
                                                         :code-theme nil
                                                         :greeting [:div "some-greeting"]
                                                         :word-wrap? true
                                                         :font-scale 1.5
                                                         :image-display "raw"
                                                         :repl-input {:repl-input/id "output-view"}})))
          (testing "should set webview html to the page, rendered as an HTML document"
            (is (= "<!DOCTYPE html><html lang=\"en\"></html>" (.. webview-panel -webview -html)))))
        (finally
          (set! (.-randomUUID crypto-mod) orig-random-uuid))))))

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
                                                                                  :code-theme "dark"
                                                                                  :token-colors nil})))))
      (testing "when the ColorThemeKind is Light, should set the code theme to light"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:Light color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :code-theme "light"
                                                                                  :token-colors nil})))))
      (testing "when the ColorThemeKind is HighContrast, should set the code theme to high-contrast"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:HighContrast color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :code-theme "high-contrast"
                                                                                  :token-colors nil})))))
      (testing "when the ColorThemeKind is HighContrastLight, should set the code theme to high-contrast-light"
        (let [post-message-to-webview-spy (spy/spy)]
          (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
            (sut/set-code-theme! context {:color-theme-kind (:HighContrastLight color-theme-kind-enum)
                                          :webview-panel webview-panel})
            (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                                  :code-theme "high-contrast-light"
                                                                                  :token-colors nil})))))
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

(deftest set-code-theme!-token-colors-test
  (testing "sends the active color theme's code colors with the code theme"
    (let [dark 0
          context {:vscode/vscode (clj->js {:ColorThemeKind {:Dark dark}})}
          webview-panel {:some "mock-webview-panel"}
          post-message-to-webview-spy (spy/spy)]
      (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)
                    token-colors/active-theme-hljs-colors (fn [kind]
                                                            (when (= dark kind)
                                                              {"keyword" "#ff7b72"}))]
        (sut/set-code-theme! context {:color-theme-kind dark
                                      :webview-panel webview-panel})
        (is (spy/called-once-with? post-message-to-webview-spy webview-panel {:command/name "set-code-theme"
                                                                              :code-theme "dark"
                                                                              :token-colors {"keyword" "#ff7b72"}}))))))

(deftest post-code-theme-to-all-views!-test
  (testing "sets the code theme of every registered webview"
    (let [set-code-theme-spy (spy/spy)
          webview-a #js {}
          webview-b #js {}
          context {:vscode/vscode #js {}}]
      (with-redefs [sut/registered-webviews (atom #{webview-a webview-b})
                    sut/set-code-theme! (test-util/wrap-spy set-code-theme-spy)]
        (sut/post-code-theme-to-all-views! context 2)
        (is (spy/called-with? set-code-theme-spy context {:color-theme-kind 2 :webview-panel webview-a}))
        (is (spy/called-with? set-code-theme-spy context {:color-theme-kind 2 :webview-panel webview-b}))
        (is (spy/called-n-times? set-code-theme-spy 2))))))

(deftest create-color-theme-change-listener-test
  (testing "posts the code theme of the new color theme kind to all views"
    (let [captured-handler (atom nil)
          post-spy (spy/spy)
          context {:vscode/vscode #js {:window #js {:onDidChangeActiveColorTheme (fn [handler]
                                                                                    (reset! captured-handler handler)
                                                                                    "some-listener")}}}]
      (with-redefs [sut/post-code-theme-to-all-views! (test-util/wrap-spy post-spy)]
        (is (= "some-listener" (sut/create-color-theme-change-listener context)))
        (@captured-handler #js {:kind 1})
        (is (spy/called-once-with? post-spy context 1))))))

(deftest create-token-color-customizations-change-listener-test
  (let [captured-handler (atom nil)
        context {:vscode/vscode #js {:window #js {:activeColorTheme #js {:kind 2}}
                                     :workspace #js {:onDidChangeConfiguration (fn [handler]
                                                                                 (reset! captured-handler handler)
                                                                                 "some-listener")}}}
        event-for (fn [affected-section]
                    #js {:affectsConfiguration #(= affected-section %)})]
    (testing "posts the code theme to all views when editor.tokenColorCustomizations changes"
      (let [post-spy (spy/spy)]
        (with-redefs [sut/post-code-theme-to-all-views! (test-util/wrap-spy post-spy)]
          (is (= "some-listener" (sut/create-token-color-customizations-change-listener context)))
          (@captured-handler (event-for "editor.tokenColorCustomizations"))
          (is (spy/called-once-with? post-spy context 2)))))
    (testing "ignores other configuration changes"
      (let [post-spy (spy/spy)]
        (with-redefs [sut/post-code-theme-to-all-views! (test-util/wrap-spy post-spy)]
          (sut/create-token-color-customizations-change-listener context)
          (@captured-handler (event-for "editor.wordWrap"))
          (is (spy/not-called? post-spy)))))))

(deftest init-code-theme!-test
  (testing "registers the color theme, the token color customizations and the extensions listeners as subscriptions"
    (let [push-spy (spy/spy)
          vscode-context-stub #js {:subscriptions #js {:push (test-util/wrap-spy push-spy)}}]
      (with-redefs [util/vscode (atom #js {})
                    util/vscode-context (atom vscode-context-stub)
                    sut/create-color-theme-change-listener (constantly "color-theme-listener")
                    sut/create-token-color-customizations-change-listener (constantly "customizations-listener")
                    sut/create-extensions-change-listener (constantly "extensions-listener")]
        (sut/init-code-theme!)
        (is (spy/called-with? push-spy "color-theme-listener"))
        (is (spy/called-with? push-spy "customizations-listener"))
        (is (spy/called-with? push-spy "extensions-listener"))))))

(deftest create-view-state-change-listener-test
  (testing "Given a context and a webview panel, should call onDidChangeViewState and pass it a function"
    (let [on-did-change-view-state-spy (spy/spy)
          webview-panel-stub #js {:onDidChangeViewState (test-util/wrap-spy on-did-change-view-state-spy)}]
      (sut/create-view-state-change-listener {} {:webview-panel webview-panel-stub})
      (let [calls (spy/calls on-did-change-view-state-spy)]
        (is (= 1 (count calls)))
        (is (fn? (type (ffirst calls))))))))

(deftest page-loaded-posts-repl-input-state
  (let [!listener (atom nil)
        !posted (atom [])
        webview-host #js {:webview #js {:onDidReceiveMessage #(reset! !listener %)
                                        :postMessage #(swap! !posted conj (reader/read-string %))}}
        setting #js {"output-view" true}]
    (with-redefs [util/vscode (atom #js {:workspace #js {:getConfiguration (fn [_section] #js {:get (fn [_setting] setting)})}})]
      (sut/listen-for-page-loaded! webview-host "output-view")
      (@!listener #js {:command "repl-input-changed"})
      (is (empty? @!posted)
          "Other messages are left to the other listeners")
      (@!listener #js {:command "page-loaded"})
      (is (match? [{:command/name "repl-input-enabled" :repl-input/id "output-view" :repl-input/enabled? true}]
                  @!posted)
          "A loaded page gets the REPL Input's state from the setting"))))

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
      (with-redefs [util/vscode (atom nil)
                    util/vscode-context (atom nil)
                    sut/set-webview-html! (test-util/wrap-spy set-webview-html-spy)
                    sut/add-subscriptions! (test-util/wrap-spy add-subscriptions-spy)
                    sut/initialize-webview-panel (test-util/wrap-spy initialize-webview-panel-spy)]
        (let [result (sut/create-repl-output-webview-panel context)]
          (testing "should call createWebviewPanel with expected args"
            (let [calls (spy/calls create-webview-panel-spy)]
              (is (= 1 (count calls)))
              (is (= [["calva.output-view"
                       "REPL Output"
                       {:preserveFocus true, :viewColumn 1}
                       {:enableScripts true
                        :enableCommandUris ["calva.showReplOutputView"]
                        :localResourceRoots []
                        :retainContextWhenHidden true
                        :enableFindWidget true}]]
                     (mapv vec (js->clj calls :keywordize-keys true))))))
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

(deftest error-message-test
  (testing "Given options, the error text and JS cause messages,"
    (let [causes (clj->js [{:class "clojure.lang.ExceptionInfo"
                            :message "Could not start"
                            :phase []
                            :id "7"
                            :stacktrace [{:name "myproj.core$start_BANG_/invokeStatic"
                                          :file-url []
                                          :flags ["project" "clj"]}]}])]
      (testing "should return one show-error message with the causes as data"
        (is (= {:command/name "show-error"
                :error/text "Execution error"
                :error/category "evalErr"
                :error/causes [{:class "clojure.lang.ExceptionInfo"
                                :message "Could not start"
                                :phase nil
                                :stacktrace [{:name "myproj.core$start_BANG_/invokeStatic"
                                              :file-url nil
                                              :flags #{"project" "clj"}}]}]
                :error/unfolded? false
                :id "e1"
                :meta {:meta/ns "user"}}
               (sut/error-message (clj->js {:outputCategory "evalErr" :ns "user"})
                                  "Execution error"
                                  causes
                                  "e1"))))
      (testing "should start unfolded when the options say so"
        (is (true? (:error/unfolded? (sut/error-message (clj->js {:outputCategory "evalErr" :unfolded true})
                                                        "Execution error"
                                                        causes
                                                        "e1")))))))
  (testing "Given causes that come later, should return a message without causes"
    (is (= [] (:error/causes (sut/error-message (clj->js {:outputCategory "evalErr"}) "Execution error" nil "e1"))))))

(deftest attach-error-causes-test
  (let [post-message-to-webview-spy (spy/spy)]
    (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)
                  sut/output-view-webview-panel (atom nil)]
      (sut/attach-error-causes "e1" (clj->js []))
      (is (spy/called-once-with? post-message-to-webview-spy nil (sut/causes-message "e1" (clj->js [])))
          "A closed Output View stays closed: there is no panel to post to"))))

(deftest causes-message-test
  (is (= {:command/name "show-error-causes"
          :error/id "e1"
          :error/causes [{:class "java.lang.ArithmeticException" :message nil :stacktrace []}]}
         (sut/causes-message "e1" (clj->js [{:class "java.lang.ArithmeticException" :message [] :stacktrace []}])))
      "Gives the entry its causes as data"))

(deftest append-error-test
  (testing "when the webview panel exists, should post the error message to it"
    (let [post-message-to-webview-spy (spy/spy)]
      (with-redefs [sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)
                    sut/output-view-webview-panel (atom "webview-panel-stub")]
        (sut/append-error (clj->js {:outputCategory "evalErr"}) "Execution error" (clj->js []) "e1")
        (is (spy/called-once-with? post-message-to-webview-spy
                                   "webview-panel-stub"
                                   {:command/name "show-error"
                                    :error/text "Execution error"
                                    :error/category "evalErr"
                                    :error/causes []
                                    :error/unfolded? false
                                    :id "e1"}))))))

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
  (testing "returns the configured setting when it is a valid number"
    (with-redefs [util/vscode (atom (vscode-with-font-scale-setting 1.5))]
      (is (= 1.5 (sut/get-output-views-font-scale-setting)))))
  (testing "returns 1.0 when the configured setting is nil"
    (with-redefs [util/vscode (atom (vscode-with-font-scale-setting nil))]
      (is (= 1.0 (sut/get-output-views-font-scale-setting)))))
  (testing "returns 1.0 when the configured setting is NaN"
    (with-redefs [util/vscode (atom (vscode-with-font-scale-setting js/NaN))]
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

(defn vscode-with-calva-setting
  [setting-name setting-value]
  #js {:workspace #js {:getConfiguration (fn [_section]
                                           #js {:get (fn [setting]
                                                       (when (= setting-name setting)
                                                         setting-value))})}})

(deftest get-image-display-setting-test
  (testing "returns \"images\" when VS Code is not available"
    (with-redefs [util/vscode (atom nil)]
      (is (= "images" (sut/get-image-display-setting)))))
  (testing "returns \"images\" when the setting is not set"
    (with-redefs [util/vscode (atom (vscode-with-calva-setting "outputViewImageDisplay" js/undefined))]
      (is (= "images" (sut/get-image-display-setting)))))
  (testing "returns \"images\" when the setting is \"images\""
    (with-redefs [util/vscode (atom (vscode-with-calva-setting "outputViewImageDisplay" "images"))]
      (is (= "images" (sut/get-image-display-setting)))))
  (testing "returns \"images-including-remote-urls\" when the setting is \"images-including-remote-urls\""
    (with-redefs [util/vscode (atom (vscode-with-calva-setting "outputViewImageDisplay" "images-including-remote-urls"))]
      (is (= "images-including-remote-urls" (sut/get-image-display-setting)))))
  (testing "returns \"raw\" when the setting is \"raw\""
    (with-redefs [util/vscode (atom (vscode-with-calva-setting "outputViewImageDisplay" "raw"))]
      (is (= "raw" (sut/get-image-display-setting))))))

(deftest image-display-test
  (testing "uses the setting when there is no override"
    (with-redefs [sut/image-display-override (atom nil)
                  sut/get-image-display-setting (constantly "raw")]
      (is (= "raw" (sut/image-display)))))
  (testing "uses the override when present"
    (with-redefs [sut/image-display-override (atom "images")
                  sut/get-image-display-setting (constantly "raw")]
      (is (= "images" (sut/image-display))))))

(deftest set-image-display-context!-test
  (testing "sets the output view image display context"
    (let [execute-command-spy (spy/spy)
          vscode (clj->js {:commands {:executeCommand (test-util/wrap-spy execute-command-spy)}})]
      (with-redefs [util/vscode (atom vscode)]
        (sut/set-image-display-context! "raw")
        (is (spy/called-once-with? execute-command-spy "setContext" "calva:outputViewImageDisplay" "raw"))))))

(deftest post-image-display-to-all-views!-test
  (testing "posts a set-image-display message to all registered webviews"
    (let [post-message-to-webview-spy (spy/spy)
          webview-a #js {}
          webview-b #js {}]
      (with-redefs [sut/registered-webviews (atom #{webview-a webview-b})
                    sut/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
        (sut/post-image-display-to-all-views! "raw")
        (is (spy/called-with? post-message-to-webview-spy webview-a {:command/name "set-image-display"
                                                                     :image-display "raw"}))
        (is (spy/called-with? post-message-to-webview-spy webview-b {:command/name "set-image-display"
                                                                     :image-display "raw"}))
        (is (spy/called-n-times? post-message-to-webview-spy 2))))))

(deftest image-display-modes-start-at-default-test
  (testing "valid modes still include remote; the cycle list is images then raw"
    (is (= "images" sut/default-image-display))
    (is (= "images" (first sut/image-display-modes)))
    (is (= ["images" "raw" "images-including-remote-urls"] sut/image-display-modes))
    (is (= ["images" "raw"] sut/image-display-cycle-modes))))

(deftest cycle-image-display-test
  (testing "cycles remote setting to images, not through the cycle button path to remote"
    (let [set-context-spy (spy/spy)
          post-spy (spy/spy)]
      (with-redefs [sut/image-display-override (atom nil)
                    sut/get-image-display-setting (constantly "images-including-remote-urls")
                    sut/set-image-display-context! (test-util/wrap-spy set-context-spy)
                    sut/post-image-display-to-all-views! (test-util/wrap-spy post-spy)]
        (sut/cycle-image-display)
        (is (= "images" @sut/image-display-override))
        (is (spy/called-once-with? set-context-spy "images"))
        (is (spy/called-once-with? post-spy "images")))))
  (testing "flips images to raw in the override, the context and all views"
    (let [set-context-spy (spy/spy)
          post-spy (spy/spy)]
      (with-redefs [sut/image-display-override (atom nil)
                    sut/get-image-display-setting (constantly "images")
                    sut/set-image-display-context! (test-util/wrap-spy set-context-spy)
                    sut/post-image-display-to-all-views! (test-util/wrap-spy post-spy)]
        (sut/cycle-image-display)
        (is (= "raw" @sut/image-display-override))
        (is (spy/called-once-with? set-context-spy "raw"))
        (is (spy/called-once-with? post-spy "raw")))))
  (testing "cycles raw back to images"
    (let [post-spy (spy/spy)]
      (with-redefs [sut/image-display-override (atom "raw")
                    sut/get-image-display-setting (constantly "images")
                    sut/set-image-display-context! (constantly nil)
                    sut/post-image-display-to-all-views! (test-util/wrap-spy post-spy)]
        (sut/cycle-image-display)
        (is (= "images" @sut/image-display-override))
        (is (spy/called-once-with? post-spy "images")))))
  (testing "passing raw selects raw when setting is remote and override is nil"
    (let [set-context-spy (spy/spy)
          post-spy (spy/spy)]
      (with-redefs [sut/image-display-override (atom nil)
                    sut/get-image-display-setting (constantly "images-including-remote-urls")
                    sut/set-image-display-context! (test-util/wrap-spy set-context-spy)
                    sut/post-image-display-to-all-views! (test-util/wrap-spy post-spy)]
        (sut/cycle-image-display "raw")
        (is (= "raw" @sut/image-display-override))
        (is (spy/called-once-with? set-context-spy "raw"))
        (is (spy/called-once-with? post-spy "raw")))))
  (testing "passing an invalid mode leaves override in place and does not set context or post"
    (let [set-context-spy (spy/spy)
          post-spy (spy/spy)]
      (with-redefs [sut/image-display-override (atom "images")
                    sut/set-image-display-context! (test-util/wrap-spy set-context-spy)
                    sut/post-image-display-to-all-views! (test-util/wrap-spy post-spy)]
        (sut/cycle-image-display "nope")
        (is (= "images" @sut/image-display-override))
        (is (spy/not-called? set-context-spy))
        (is (spy/not-called? post-spy)))))
  (testing "a non-string argument cycles, the way the sidebar button calls the command"
    (let [set-context-spy (spy/spy)
          post-spy (spy/spy)]
      (with-redefs [sut/image-display-override (atom nil)
                    sut/get-image-display-setting (constantly "images-including-remote-urls")
                    sut/set-image-display-context! (test-util/wrap-spy set-context-spy)
                    sut/post-image-display-to-all-views! (test-util/wrap-spy post-spy)]
        (sut/cycle-image-display nil)
        (is (= "images" @sut/image-display-override))
        (is (spy/called-once-with? set-context-spy "images"))
        (is (spy/called-once-with? post-spy "images"))))))

(deftest create-image-display-change-listener-test
  (let [captured-handler (atom nil)
        vscode-stub #js {:workspace #js {:onDidChangeConfiguration (fn [handler]
                                                                     (reset! captured-handler handler)
                                                                     "some-listener")}}
        event-for (fn [affected-section]
                    #js {:affectsConfiguration #(= affected-section %)})]
    (testing "clears the override and posts the setting when calva.outputViewImageDisplay changes"
      (let [post-spy (spy/spy)]
        (with-redefs [util/vscode (atom vscode-stub)
                      sut/image-display-override (atom "raw")
                      sut/get-image-display-setting (constantly "images")
                      sut/set-image-display-context! (constantly nil)
                      sut/post-image-display-to-all-views! (test-util/wrap-spy post-spy)]
          (is (= "some-listener" (sut/create-image-display-change-listener)))
          (@captured-handler (event-for "calva.outputViewImageDisplay"))
          (is (nil? @sut/image-display-override))
          (is (spy/called-once-with? post-spy "images")))))
    (testing "ignores other configuration changes"
      (let [post-spy (spy/spy)]
        (with-redefs [util/vscode (atom vscode-stub)
                      sut/image-display-override (atom "raw")
                      sut/post-image-display-to-all-views! (test-util/wrap-spy post-spy)]
          (sut/create-image-display-change-listener)
          (@captured-handler (event-for "calva.outputViews.wordWrap"))
          (is (= "raw" @sut/image-display-override))
          (is (spy/not-called? post-spy)))))))

(deftest init-image-display!-test
  (testing "sets the context and registers the configuration change listener as a subscription"
    (let [push-spy (spy/spy)
          set-context-spy (spy/spy)
          vscode-context-stub #js {:subscriptions #js {:push (test-util/wrap-spy push-spy)}}]
      (with-redefs [util/vscode-context (atom vscode-context-stub)
                    sut/image-display (constantly "images")
                    sut/set-image-display-context! (test-util/wrap-spy set-context-spy)
                    sut/create-image-display-change-listener (constantly "some-listener")]
        (sut/init-image-display!)
        (is (spy/called-once-with? set-context-spy "images"))
        (is (spy/called-once-with? push-spy "some-listener"))))))

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
