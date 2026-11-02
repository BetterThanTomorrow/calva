(ns calva.repl.webview.sidebar-test
  (:require
   [calva.repl.input.host :as input-host]
   [calva.repl.webview.core :as core]
   [calva.repl.webview.output-log :as output-log]
   [calva.repl.webview.sidebar :as sut]
   [cljs.test :refer-macros [async deftest testing is]]
   [clojure.string :as string]
   [spy.core :as spy]
   [test-util :as test-util]
   [calva.util :as util]))

(defn- logged
  "Returns the empty output log with each `[view-id message]` of `posts` posted."
  [posts]
  (reduce (fn [log [view-id message]] (output-log/with-message log view-id message)) output-log/empty-log posts))

(defn- sidebar-log []
  (output-log/messages "output-sidebar"))

(deftest output-sidebar-in-setting?-test
  (testing "recognizes string destinations"
    (is (sut/output-sidebar-in-setting? {:evalResults "output-sidebar"}))
    (is (not (sut/output-sidebar-in-setting? {:evalResults "terminal"}))))
  (testing "recognizes output-sidebar in a top-level destination array"
    (is (sut/output-sidebar-in-setting? {:evalResults ["terminal" "output-sidebar"]})))
  (testing "skips nested destination arrays"
    (is (not (sut/output-sidebar-in-setting? {:evalResults [["output-sidebar"]]})))))

(deftest help-page-test
  (let [destinations #js {:evalResults "terminal"
                          :evalOutput "terminal"
                          :otherOutput "terminal"}]
    (with-redefs [sut/current-output-destinations (constantly destinations)]
      (let [page (sut/help-page "csp-source")
            nodes (tree-seq #(or (vector? %) (seq? %)) #(if (vector? %) (rest %) %) page)
            text (string/join " " (filter string? nodes))
            policy (some #(when (and (map? %) (= "Content-Security-Policy" (:http-equiv %))) (:content %)) nodes)
            style (some #(when (and (vector? %) (= :style (first %))) (second %)) nodes)]
        (is (string/includes? text "REPL Output"))
        (is (string/includes? text "terminal"))
        (is (string/includes? text "The current output destination configuration is"))
        (is (some #(and (map? %) (= "https://calva.io/output" (:href %))) nodes))
        (is (re-find #"^default-src 'none'; style-src csp-source 'nonce-[^']+'$" policy))
        (is (= (str "default-src 'none'; style-src csp-source 'nonce-" (:nonce style) "'") policy)
            "The page's styles carry the nonce the policy allows")))))

(deftest resolve-webview-view-test
  (let [on-did-dispose-spy (spy/stub "dispose-subscription")
        on-did-change-visibility-spy (spy/stub "visibility-subscription")
        on-did-change-configuration-spy (spy/stub "configuration-subscription")
        register-webview!-spy (spy/spy)
        unregister-webview!-spy (spy/spy)
        forgotten (atom [])
        view-hidden!-spy (spy/spy)
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
                  sut/output-sidebar-webview-view (atom nil)
                  output-log/!log (atom output-log/empty-log)
                  input-host/enabled? (constantly false)
                  input-host/view-page-set! #(swap! forgotten conj [:page-set %])
                  input-host/view-disposed! #(swap! forgotten conj [:disposed %])
                  input-host/view-hidden! (test-util/wrap-spy view-hidden!-spy)
                  core/register-webview! (test-util/wrap-spy register-webview!-spy)
                  core/unregister-webview! (test-util/wrap-spy unregister-webview!-spy)]
      (let [provider (sut/create-repl-output-sidebar-provider)]
        (.resolveWebviewView ^js provider webview-view nil nil)
        (is (= webview-view @sut/output-sidebar-webview-view))
        (is (spy/called-once-with? register-webview!-spy webview-view))
        (is (re-find #"REPL Output" (.. ^js webview-view -webview -html)))
        (is (= "REPL Output" (.-title webview-view)))
        (testing "should register a configuration-change callback"
          (let [calls (spy/calls on-did-change-configuration-spy)]
            (is (= 1 (count calls)))
            (is (fn? (type (first (first calls)))))))
        (testing "should register a visibility-change callback"
          (let [calls (spy/calls on-did-change-visibility-spy)]
            (is (= 1 (count calls)))
            (is (fn? (type (first (first calls)))))))
        (testing "should tell the REPL Input host when the view is hidden"
          ((ffirst (spy/calls on-did-change-visibility-spy)))
          (is (spy/called-once-with? view-hidden!-spy "output-sidebar")))
        ((ffirst (spy/calls on-did-dispose-spy)))
        (is (nil? @sut/output-sidebar-webview-view))
        (is (spy/called-once-with? unregister-webview!-spy webview-view))
        (testing "should drop the REPL Input's record when the page is set with the REPL Input off, and when the view is disposed"
          (is (= [[:disposed "output-sidebar"] [:disposed "output-sidebar"]] @forgotten)))))))

(deftest show-repl-output-sidebar-test
  (let [show-spy (spy/spy)
        webview-view #js {:show (test-util/wrap-spy show-spy)}]
    (with-redefs [sut/output-sidebar-webview-view (atom webview-view)]
      (sut/show-repl-output-sidebar false)
      (is (spy/called-once-with? show-spy false)))))

(deftest some-output-view-visible?-test
  (with-redefs [sut/output-sidebar-webview-view (atom #js {:visible true})
                core/output-view-webview-panel (atom #js {:visible false})]
    (testing "is true when a destination is a visible Output view"
      (is (true? (sut/some-output-view-visible? "output-sidebar")))
      (is (true? (sut/some-output-view-visible? #js ["terminal" "output-sidebar"]))))
    (testing "is false when the Output views among the destinations are hidden"
      (is (false? (sut/some-output-view-visible? #js ["terminal" "output-view"]))))
    (testing "skips nested destination arrays, which are file paths"
      (is (false? (sut/some-output-view-visible? #js [#js ["output-sidebar"]]))))))

(deftest scroll-to-end-test
  (async done
    (let [sidebar #js {:webview #js {}}
          output-view #js {:webview #js {}}
          !posted (atom [])
          !shown (atom nil)
          !pick (atom nil)
          originals [sut/output-sidebar-webview-view core/output-view-webview-panel
                     core/post-message-to-webview util/vscode]
          scrolled+ (fn [destination pick]
                      (reset! !posted [])
                      (reset! !shown nil)
                      (reset! !pick pick)
                      (.then (sut/scroll-to-end destination) (fn [_] [@!posted @!shown])))]
      (set! sut/output-sidebar-webview-view (atom sidebar))
      (set! core/output-view-webview-panel (atom output-view))
      (set! core/post-message-to-webview (fn [host _message] (swap! !posted conj host)))
      (set! util/vscode (atom #js {:window #js {:showQuickPick (fn [items _options]
                                                                 (reset! !shown (mapv #(.-label %) items))
                                                                 (js/Promise.resolve (some->> @!pick (aget items))))}}))
      (-> (scrolled+ "output-sidebar" nil)
          (.then (fn [named]
                   (is (= [[sidebar] nil] named)
                       "Scrolls the Output view the destination names, without asking")
                   (scrolled+ js/undefined 0)))
          (.then (fn [no-id]
                   (is (= [[output-view] ["Output View - Editor Panel" "Output View - Sidebar Panel"]] no-id)
                       "Without a destination, scrolls the Output view picked in the quick pick")
                   (scrolled+ "terminal" 1)))
          (.then (fn [unsupported]
                   (is (= [[sidebar] ["Output View - Editor Panel" "Output View - Sidebar Panel"]] unsupported)
                       "For a destination that isn't an Output view, scrolls the Output view picked")
                   (scrolled+ nil nil)))
          (.then (fn [cancelled]
                   (is (= [] (first cancelled))
                       "Scrolls nothing when the quick pick is cancelled")
                   (reset! core/output-view-webview-panel nil)
                   (scrolled+ "output-view" nil)))
          (.then (fn [closed]
                   (is (= [[] nil] closed)
                       "Scrolls nothing when the Output view isn't open")))
          (.finally (fn []
                      (let [[sidebar-view output-view-panel post vscode] originals]
                        (set! sut/output-sidebar-webview-view sidebar-view)
                        (set! core/output-view-webview-panel output-view-panel)
                        (set! core/post-message-to-webview post)
                        (set! util/vscode vscode))
                      (done)))))))

(deftest append-test
  (let [post-message-to-webview-spy (spy/spy)
        options (clj->js {:outputCategory "evalOut"})]
    (with-redefs [sut/current-output-destinations (constantly {:evalOutput "output-sidebar"})
                  sut/output-sidebar-webview-view (atom nil)
                  output-log/!log (atom output-log/empty-log)
                  core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
      (sut/append options "some-output")
      (is (= [{:command/name "show-stdout" :output-category "evalOut" :output "some-output"}]
             (sidebar-log)))
      (is (spy/not-called? post-message-to-webview-spy))))
  (testing "when options carry metadata, should include :meta in the logged message"
    (let [post-message-to-webview-spy (spy/spy)
          options (clj->js {:outputCategory "evalOut"
                            :who "repl"
                            :ns "user"
                            :replSessionKey "clj"})]
      (with-redefs [sut/current-output-destinations (constantly {:evalOutput "output-sidebar"})
                    sut/output-sidebar-webview-view (atom nil)
                    output-log/!log (atom output-log/empty-log)
                    core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
        (sut/append options "some-output")
        (is (= [{:command/name "show-stdout"
                 :output-category "evalOut"
                 :output "some-output"
                 :meta {:meta/who "repl"
                        :meta/ns "user"
                        :meta/repl-session-key "clj"}}]
               (sidebar-log)))))))

(deftest log-without-highlighting-test
  (let [post-message-to-webview-spy (spy/spy)
        message {:command/name "show-result" :output "42" :output/highlighting [[0 2 "#79c0ff" nil]]}]
    (with-redefs [sut/current-output-destinations (constantly {:evalResults "output-sidebar"})
                  sut/output-sidebar-webview-view (atom {:some "view"})
                  output-log/!log (atom output-log/empty-log)
                  core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
      (sut/add-output-sidebar-message! message)
      (is (spy/called-once-with? post-message-to-webview-spy {:some "view"} message)
          "The sidebar gets the printed code with its highlighting")
      (is (= [(dissoc message :output/highlighting)] (sidebar-log))
          "The log keeps it without, for a page that shows the log later to ask in its own colors"))))

(deftest append-error-test
  (let [post-message-to-webview-spy (spy/spy)
        webview-view #js {:webview #js {}}
        expected-message {:command/name "show-error"
                          :error/text "Execution error"
                          :error/category "evalErr"
                          :error/causes [{:class "clojure.lang.ExceptionInfo" :message nil :stacktrace []}]
                          :error/unfolded? false
                          :id "e1"}]
    (with-redefs [sut/current-output-destinations (constantly {:evalOutput "output-sidebar"})
                  sut/output-sidebar-webview-view (atom webview-view)
                  output-log/!log (atom output-log/empty-log)
                  core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
      (sut/append-error (clj->js {:outputCategory "evalErr"})
                        "Execution error"
                        (clj->js [{:class "clojure.lang.ExceptionInfo" :message [] :stacktrace []}])
                        "e1")
      (is (= [expected-message] (sidebar-log))
          "Logs the error so the sidebar can show it again")
      (is (spy/called-once-with? post-message-to-webview-spy webview-view expected-message)))))

(deftest clear-output-sidebar-test
  (let [post-message-to-webview-spy (spy/spy)
        webview-view #js {:webview #js {}}
        log (logged [["output-sidebar" {:command/name "show-stdout" :output "old"}]
                     ["output-view" {:command/name "show-stdout" :output "the view's"}]])]
    (with-redefs [sut/output-sidebar-webview-view (atom webview-view)
                  sut/output-sidebar-showing-output-log? (atom false)
                  output-log/!log (atom log)
                  core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
      (sut/clear-output-sidebar)
      (is (= [] (sidebar-log)))
      (is (= [{:command/name "show-stdout" :output "the view's"}] (output-log/messages "output-view"))
          "The Output View keeps its output")
      (is (spy/called-once-with? post-message-to-webview-spy
                                 webview-view
                                 {:command/name "clear-output-view"}))))
  (let [post-message-to-webview-spy (spy/spy)
        log (logged [["output-sidebar" {:command/name "show-stdout" :output "old"}]])]
    (with-redefs [sut/output-sidebar-webview-view (atom nil)
                  output-log/!log (atom log)
                  core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
      (sut/clear-output-sidebar)
      (is (= [] (sidebar-log)))
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
                  output-log/!log (atom (logged (map #(vector "output-sidebar" %) output-log)))
                  input-host/enabled? (constantly false)
                  core/set-webview-html! (test-util/wrap-spy set-webview-html!-spy)
                  core/set-code-theme! (test-util/wrap-spy set-code-theme!-spy)
                  core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
      (let [provider (sut/create-repl-output-sidebar-provider)]
        (.resolveWebviewView ^js provider webview-view nil nil)
        (.resolveWebviewView ^js provider webview-view nil nil)
        (is (= output-log (sidebar-log)))
        (is (= 2 (count (spy/calls set-webview-html!-spy))))
        (is (= 2 (count (spy/calls set-code-theme!-spy))))
        (is (= 4 (count (spy/calls post-message-to-webview-spy))))
        (is (= :output-sidebar
               (-> (spy/calls set-webview-html!-spy) first second :view-kind)))
        (is (= ["first" "second" "first" "second"]
               (map #(-> % second :output) (spy/calls post-message-to-webview-spy))))))))

(deftest apply-sidebar-help-or-output-log!-repl-input-test
  (let [webview-view #js {:webview #js {:cspSource "csp-source"}}
        vscode-stub #js {:window #js {:activeColorTheme #js {:kind 1}}}
        set-webview-html!-spy (spy/spy)]
    (with-redefs [util/vscode (atom vscode-stub)
                  util/vscode-context (atom #js {})
                  sut/current-output-destinations (constantly {:evalResults "terminal"})
                  sut/output-sidebar-webview-view (atom webview-view)
                  output-log/!log (atom (logged [["output-sidebar" {:command/name "show-stdout" :output "stale"}]]))
                  sut/output-sidebar-showing-output-log? (atom false)
                  input-host/enabled? (constantly true)
                  core/set-webview-html! (test-util/wrap-spy set-webview-html!-spy)
                  core/set-code-theme! (constantly nil)
                  core/post-message-to-webview (constantly nil)]
      (sut/apply-sidebar-help-or-output-log! webview-view)
      (testing "shows the output page when the REPL Input is on, without the sidebar as destination"
        (is (= :output-sidebar (-> (spy/calls set-webview-html!-spy) first second :view-kind)))
        (is @sut/output-sidebar-showing-output-log?))
      (testing "keeps no output log when the sidebar is not a destination"
        (is (= [] (sidebar-log))))
      (testing "titles the view REPL"
        (is (= "REPL" (.-title webview-view)))))))

(deftest output-destinations-change-test
  (let [on-did-change-configuration-spy (spy/stub "configuration-subscription")
        webview-view #js {:webview #js {:cspSource "csp-source"}
                          :visible true
                          :onDidDispose (constantly "dispose-subscription")
                          :onDidChangeVisibility (constantly "visibility-subscription")}
        vscode-stub #js {:workspace #js {:onDidChangeConfiguration
                                         (test-util/wrap-spy on-did-change-configuration-spy)}
                         :window #js {:activeColorTheme #js {:kind 1}}}
        destinations (atom {:evalResults "output-sidebar"})
        destinations-changed #js {:affectsConfiguration #(= "calva.outputDestinations" %)}
        set-webview-html!-spy (spy/spy)
        post-message-to-webview-spy (spy/spy)]
    (with-redefs [util/vscode (atom vscode-stub)
                  util/vscode-context (atom #js {:extensionUri "extension-uri" :subscriptions #js []})
                  sut/current-output-destinations #(deref destinations)
                  sut/output-sidebar-webview-view (atom nil)
                  output-log/!log (atom (logged [["output-sidebar" {:command/name "show-stdout" :output "first"}]]))
                  sut/output-sidebar-showing-output-log? (atom false)
                  input-host/enabled? (constantly false)
                  core/set-webview-html! (test-util/wrap-spy set-webview-html!-spy)
                  core/set-code-theme! (constantly nil)
                  core/post-message-to-webview (test-util/wrap-spy post-message-to-webview-spy)]
      (let [provider (sut/create-repl-output-sidebar-provider)
            on-change (ffirst (spy/calls on-did-change-configuration-spy))]
        (.resolveWebviewView ^js provider webview-view nil nil)
        (reset! destinations {:evalResults ["terminal" "output-sidebar"]})
        (on-change destinations-changed)
        (testing "keeps the page and its output when the sidebar stays a destination"
          (is (= 1 (count (spy/calls set-webview-html!-spy))))
          (is (= 1 (count (spy/calls post-message-to-webview-spy)))))
        (reset! destinations {:evalResults "terminal"})
        (on-change destinations-changed)
        (testing "shows the help when the sidebar is no longer a destination"
          (is (not @sut/output-sidebar-showing-output-log?))
          (is (re-find #"REPL Output" (.. ^js webview-view -webview -html))))))))
