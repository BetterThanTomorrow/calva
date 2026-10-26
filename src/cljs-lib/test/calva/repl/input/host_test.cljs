(ns calva.repl.input.host-test
  (:require
   [calva.repl.input.command-keys :as command-keys]
   [calva.repl.input.host :as sut]
   [calva.repl.input.host-fixtures :refer [last-context-line post! posted-named with-fresh-host with-view]]
   [calva.util :as util]
   [cljs.test :refer-macros [async deftest testing is]]))

(deftest handle-message!-records-test
  (with-fresh-host
    (fn [host]
      (with-view host
        (fn []
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "" :selections [[0 0]]})
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 2 :text "(+ 1 2)" :selections [[7 7]]})
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 1 :text "(+ 1" :selections [[4 4]]})
          (testing "keeps the newest change for the REPL Input"
            (is (= {:repl-input/id "output-view" :repl-input/version 2 :repl-input/text "(+ 1 2)" :repl-input/selections [[7 7]]}
                   (select-keys (get-in @sut/!state [:repl-input/records "output-view"])
                                [:repl-input/id :repl-input/version :repl-input/text :repl-input/selections]))))
          (post! {:command "repl-input-unmounted" :repl-input/id "output-view"})
          (testing "drops the record when the REPL Input unmounts"
            (is (= {} (:repl-input/records @sut/!state)))))))))

(defn- context-values
  [contexts k]
  (mapv second (filter #(= k (first %)) @contexts)))

(deftest handle-message!-focus-test
  (with-fresh-host
    (fn [{:keys [contexts] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-focused" :repl-input/id "output-sidebar"})
          (testing "sets the focus contexts when a REPL Input gets focus"
            (is (= [["calva:replInputFocused" true] ["calva:replInputLastFocused" true]] @contexts))
            (is (sut/focused?)))
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (testing "leaves the contexts as they are when focus moves between REPL Inputs"
            (is (= 2 (count @contexts))))
          (post! {:command "repl-input-blurred" :repl-input/id "output-sidebar"})
          (testing "ignores a late blur from the REPL Input that lost focus earlier"
            (is (= 2 (count @contexts))))
          (sut/text-editor-focused!)
          (testing "clears the contexts when a text editor gets focus"
            (is (= [["calva:replInputFocused" false] ["calva:replInputLastFocused" false]] (take-last 2 @contexts)))
            (is (not (sut/focused?)))))))))

(deftest view-lifecycle-focus-test
  (with-fresh-host
    (fn [{:keys [contexts] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (sut/view-hidden! "output-view")
          (testing "clears the contexts when the view is hidden"
            (is (= [true false] (context-values contexts "calva:replInputFocused")))
            (is (= [true false] (context-values contexts "calva:replInputLastFocused"))))
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (sut/view-disposed! "output-view")
          (testing "clears the contexts when the view is disposed"
            (is (= [true false true false] (context-values contexts "calva:replInputFocused")))
            (is (= [true false true false] (context-values contexts "calva:replInputLastFocused")))))))))

(deftest last-focused-test
  (with-fresh-host
    (fn [{:keys [contexts posted] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "" :selections [[0 0]]})
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (post! {:command "repl-input-blurred" :repl-input/id "output-view"})
          (testing "keeps the REPL Input the last focused place when it loses the focus, as to the command palette"
            (is (= [true false] (context-values contexts "calva:replInputFocused")))
            (is (= [true] (context-values contexts "calva:replInputLastFocused")))
            (is (sut/focused?)))
          (sut/run-in-focused! "joinLines")
          (testing "runs Calva's commands in the last focused REPL Input, and gives it the focus back"
            (is (= ["output-view"] (mapv :repl-input/id (posted-named posted "repl-input-run-command"))))
            (is (= ["output-view"] (mapv :repl-input/id (posted-named posted "repl-input-focus")))))
          (sut/terminal-focused!)
          (testing "ends it when a terminal gets the focus"
            (is (= [true false] (context-values contexts "calva:replInputLastFocused")))
            (is (not (sut/focused?))))
          (sut/run-in-focused! "joinLines")
          (testing "runs nothing when no REPL Input is the last focused place"
            (is (= 1 (count (posted-named posted "repl-input-run-command")))))
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (post! {:command "repl-input-blurred" :repl-input/id "output-view"})
          (sut/view-state-changed! "output-view" true false)
          (testing "ends it when its view goes inactive, as when another editor gets the focus"
            (is (= [true false true false] (context-values contexts "calva:replInputLastFocused")))))))))

(deftest not-last-focused-test
  (with-fresh-host
    (fn [{:keys [posted] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "" :selections [[0 0]]})
          (post! {:command "repl-input-mounted" :repl-input/id "output-sidebar" :version 0 :text "" :selections [[0 0]]})
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (testing "tells the other REPL Inputs when one becomes the last focused place"
            (is (= ["output-sidebar"] (mapv :repl-input/id (posted-named posted "repl-input-not-last-focused")))))
          (post! {:command "repl-input-blurred" :repl-input/id "output-view"})
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (testing "tells nothing new while the same REPL Input stays the last focused place"
            (is (= 1 (count (posted-named posted "repl-input-not-last-focused")))))
          (post! {:command "repl-input-focused" :repl-input/id "output-sidebar"})
          (testing "tells the REPL Input that was the last focused place, when another one takes over"
            (is (= ["output-sidebar" "output-view"]
                   (mapv :repl-input/id (posted-named posted "repl-input-not-last-focused"))))))))))

(deftest cursor-contexts-test
  (with-fresh-host
    (fn [{:keys [contexts restored] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "; a" :selections [[3 3]]})
          (testing "leaves the cursor contexts to the text editor while the REPL Input does not have focus"
            (is (= [] @contexts)))
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (testing "sets the cursor contexts from the REPL Input's document when it gets focus"
            (is (= #{["calva:replInputFocused" true] ["calva:replInputLastFocused" true] ["calva:cursorInComment" true]}
                   (set @contexts))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 1 :text "; ab" :selections [[4 4]]})
          (testing "sets only the contexts that change"
            (is (= 3 (count @contexts))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 2 :text "a" :selections [[1 1]]})
          (testing "follows the REPL Input's cursor"
            (is (= ["calva:cursorInComment" false] (last @contexts))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 3 :text "; a" :selections [[3 3]]})
          (reset! restored false)
          (sut/text-editor-focused!)
          (testing "clears the cursor contexts it set when no text editor takes them back"
            (is (= ["calva:cursorInComment" false] (last @contexts))))
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (reset! contexts [])
          (reset! restored true)
          (post! {:command "repl-input-blurred" :repl-input/id "output-view"})
          (testing "leaves the cursor contexts to the text editor that takes them back"
            (is (= [["calva:replInputFocused" false]] @contexts))))))))

(deftest command-keys-test
  (with-fresh-host
    (fn [{:keys [posted] :as host}]
      (with-view host
        (fn []
          (swap! sut/!state assoc
                 :repl-input/keybindings (command-keys/parsed [{:command "calva.replInput.deleteBackward"
                                                                :key "backspace"
                                                                :when "calva:replInputFocused && !calva:cursorInComment"}
                                                               {:command "calva.replInput.formatCurrentForm"
                                                                :key "tab"
                                                                :when "calva:replInputFocused && !calva:replInputCompletionActive"}])
                 :repl-input/settings {command-keys/user-keys-setting ["ctrl+j"]})
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "" :selections [[0 0]]})
          (testing "posts the command keys to the REPL Input when it mounts, and the ones while its completion list is open"
            (is (= [{:command/name "repl-input-command-keys"
                     :repl-input/id "output-view"
                     :repl-input/version 0
                     :repl-input/command-keys {:keys #{"backspace" "tab" "ctrl+j"}
                                               :chords #{}
                                               :completion-list-keys #{"backspace" "ctrl+j"}}}]
                   (posted-named posted "repl-input-command-keys"))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 1 :text "a" :selections [[1 1]]})
          (testing "posts nothing when the keys stay the same"
            (is (= 1 (count (posted-named posted "repl-input-command-keys")))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 2 :text "; a" :selections [[3 3]]})
          (testing "posts the keys when the REPL Input's cursor contexts change them"
            (is (= {:keys #{"tab" "ctrl+j"} :chords #{} :completion-list-keys #{"ctrl+j"}}
                   (:repl-input/command-keys (last (posted-named posted "repl-input-command-keys"))))))
          (sut/settings-changed! {command-keys/user-keys-setting []})
          (testing "posts the keys when the settings change them"
            (is (= {:keys #{"tab"} :chords #{} :completion-list-keys #{}}
                   (:repl-input/command-keys (last (posted-named posted "repl-input-command-keys")))))))))))

(deftest edit-focused!-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted] :as host}]
        (with-view host
          (fn []
            (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "(a)" :selections [[2 2]]})
            (post! {:command "repl-input-focused" :repl-input/id "output-view"})
            (-> (sut/edit-focused! (fn [^js doc]
                                     (set! (.-text doc) "(a b)")
                                     (set! (.-selections doc) #js [#js [4 4]])))
                (.then (fn [_]
                         (testing "posts what the command made of the focused REPL Input's document, for the version it ran on"
                           (is (= [{:command/name "repl-input-edit"
                                    :repl-input/id "output-view"
                                    :repl-input/version 0
                                    :text "(a b)"
                                    :selections [[4 4]]}]
                                  (posted-named posted "repl-input-edit"))))
                         (testing "the record expects the edited version"
                           (is (= [1 "(a b)"]
                                  ((juxt :repl-input/version :repl-input/text)
                                   (get-in @sut/!state [:repl-input/records "output-view"])))))
                         (sut/edit-focused! (fn [^js doc]
                                              (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 2 :text "(a b c)" :selections [[6 6]]})
                                              (set! (.-text doc) "(a b d)")))))
                (.then (fn [_]
                         (testing "drops the edit when the REPL Input changed while the command ran"
                           (is (= 1 (count (posted-named posted "repl-input-edit"))))
                           (is (= "(a b c)" (get-in @sut/!state [:repl-input/records "output-view" :repl-input/text]))))
                         (sut/edit-focused! (fn [_]))))
                (.then (fn [_]
                         (testing "posts nothing when the command changed nothing"
                           (is (= 1 (count (posted-named posted "repl-input-edit")))))
                         (done))))))))))

(deftest brackets-test
  (with-fresh-host
    (fn [{:keys [posted] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "(a)" :selections [[3 3]]})
          (testing "posts the brackets of the REPL Input's text, for its version, when it mounts"
            (is (= [{:command/name "repl-input-brackets"
                     :repl-input/id "output-view"
                     :repl-input/version 0
                     :repl-input/brackets {:text "(a)" :colorCount 1}}]
                   (posted-named posted "repl-input-brackets"))))
          (testing "posts the closing brackets and the bracket styles when it mounts"
            (is (= [["(" "[" "{" "\""]]
                   (map (comp :close-brackets :repl-input/editor-settings)
                        (posted-named posted "repl-input-editor-settings")))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 1 :text "(a)" :selections [[0 0]]})
          (testing "posts nothing when the brackets stay the same"
            (is (= 1 (count (posted-named posted "repl-input-brackets")))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 2 :text "(a b)" :selections [[5 5]]})
          (testing "posts the brackets when the text changes"
            (is (= [2 {:text "(a b)" :colorCount 1}]
                   ((juxt :repl-input/version :repl-input/brackets) (last (posted-named posted "repl-input-brackets"))))))
          (sut/settings-changed! {"editor.autoClosingBrackets" "never"
                                  "calva.highlight.bracketColors" ["#111" "#222"]})
          (testing "posts the brackets and the editor settings when the settings change them"
            (is (= 2 (:colorCount (:repl-input/brackets (last (posted-named posted "repl-input-brackets"))))))
            (is (= ["\""]
                   (:close-brackets (:repl-input/editor-settings (last (posted-named posted "repl-input-editor-settings"))))))))))))

(deftest editing-settings-test
  (with-fresh-host
    (fn [{:keys [posted] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "" :selections [[0 0]]})
          (sut/settings-changed! {"editor.multiCursorModifier" "ctrlCmd"
                                  "editor.wordSeparators" "()[]"})
          (testing "posts the multi-cursor modifier and the word separators with the editor settings"
            (is (= {:multi-cursor-modifier "ctrlCmd" :word-separators "()[]"}
                   (select-keys (:repl-input/editor-settings (last (posted-named posted "repl-input-editor-settings")))
                                [:multi-cursor-modifier :word-separators])))))))))

(deftest run-in-focused!-test
  (with-fresh-host
    (fn [{:keys [posted] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "" :selections [[0 0]]})
          (sut/run-in-focused! "joinLines")
          (testing "runs nothing when no REPL Input has focus"
            (is (= [] (posted-named posted "repl-input-run-command"))))
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (sut/run-in-focused! "joinLines")
          (testing "posts the command to the focused REPL Input"
            (is (= [{:command/name "repl-input-run-command" :repl-input/id "output-view" :repl-input/command "joinLines"}]
                   (posted-named posted "repl-input-run-command")))))))))

(deftest context-line-test
  (with-fresh-host
    (fn [{:keys [posted session-keys routes] :as host}]
      (with-view host
        (fn []
          (sut/editor-moved! #js {:ns "pirate.lib" :uri "file:///pirate/src/pirate/lib.cljs"} #js {})
          (testing "posts nothing while no REPL Input is mounted"
            (is (= [] (posted-named posted "repl-input-context"))))
          (reset! sut/!state sut/initial-state)
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "" :selections [[0 0]]})
          (testing "posts the context line when the REPL Input mounts, in `user` before any Clojure editor"
            (is (= {:repl-input.context/ns "user" :repl-input.context/session-key "clj" :repl-input.context/locked? false}
                   (last-context-line posted))))
          (sut/editor-moved! #js {:ns "pirate.lib" :uri "file:///pirate/src/pirate/lib.cljs"} #js {})
          (testing "follows the Clojure editor, in the session that routing its file gives"
            (is (= {:repl-input.context/ns "pirate.lib" :repl-input.context/session-key "cljs" :repl-input.context/locked? false}
                   (last-context-line posted))))
          (testing "carries the editor's file and its session"
            (is (= ["file:///pirate/src/pirate/lib.cljs" "cljs"]
                   ((juxt :repl-input.context/source-file :repl-input.context/editor-session-key)
                    (:repl-input/context-line (last (posted-named posted "repl-input-context")))))))
          (let [n (count (posted-named posted "repl-input-context"))]
            (sut/editor-moved! #js {:ns "pirate.lib" :uri "file:///pirate/src/pirate/lib.cljs"} #js {})
            (testing "posts nothing when the context line stays the same"
              (is (= n (count (posted-named posted "repl-input-context"))))))
          (post! {:command "repl-input-mounted" :repl-input/id "output-sidebar" :version 0 :text "" :selections [[0 0]]})
          (testing "shares the context with the other view's REPL Input"
            (is (= ["output-sidebar" "pirate.lib"]
                   ((juxt :repl-input/id (comp :repl-input.context/ns :repl-input/context-line))
                    (last (posted-named posted "repl-input-context"))))))
          (swap! routes assoc "file:///pirate/src/pirate/lib.cljs" "cljs:2")
          (sut/routing-changed!)
          (testing "routes the editor's file again when routing changes"
            (is (= "cljs:2" (:repl-input.context/session-key (last-context-line posted)))))
          (reset! routes {})
          (reset! session-keys ["clj"])
          (sut/routing-changed!)
          (testing "tells that the session isn't connected when routing changes"
            (is (= {:repl-input.context/session-key "cljs" :repl-input.context/connected? false}
                   (select-keys (:repl-input/context-line (last (posted-named posted "repl-input-context")))
                                [:repl-input.context/session-key :repl-input.context/connected?])))))))))

(deftest build-test
  (with-fresh-host
    (fn [{:keys [posted builds] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "" :selections [[0 0]]})
          (sut/editor-moved! #js {:ns "pirate.ui" :uri "file:///pirate/src/pirate/ui.cljs"} #js {})
          (testing "shows no build for a session without one"
            (is (nil? (:repl-input.context/build (:repl-input/context-line (last (posted-named posted "repl-input-context")))))))
          (reset! builds {"cljs" ":app"})
          (sut/routing-changed!)
          (testing "shows the build of the session, and of the editor's session, after a build switch"
            (is (= [":app" ":app"]
                   ((juxt :repl-input.context/build :repl-input.context/editor-build)
                    (:repl-input/context-line (last (posted-named posted "repl-input-context"))))))))))))

(deftest connect-test
  (with-fresh-host
    (fn [host]
      (with-view host
        (fn []
          (let [executed (atom [])]
            (with-redefs [util/vscode (atom #js {:commands #js {:executeCommand (fn [command] (swap! executed conj command))}})]
              (post! {:command "repl-input-connect" :repl-input/id "output-sidebar"}))
            (testing "opens the menu of the status bar's REPL button"
              (is (= ["calva.showReplMenu"] @executed)))))))))
