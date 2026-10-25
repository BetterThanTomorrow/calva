(ns calva.repl.webview.input.actions-test
  (:require
   [calva.repl.webview.input.actions :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def init-payload {:repl-input/id "output-view" :repl-input/enabled? true :repl-input/height 200})

(deftest init-test
  (testing "mounts the REPL Input with the stored height when it is on"
    (let [{:uf/keys [db fxs]} (sut/handle-action {} [:repl-input/ax.init init-payload])]
      (is (= {:repl-input/id "output-view" :repl-input/height 200 :repl-input/enabled? true :repl-input/version 0} db))
      (is (= [[:repl-input/fx.mount {:height 200}]] fxs))))
  (testing "mounts nothing when it is off"
    (let [{:uf/keys [db fxs]} (sut/handle-action {} [:repl-input/ax.init (assoc init-payload :repl-input/enabled? false)])]
      (is (= "output-view" (:repl-input/id db)))
      (is (empty? fxs)))))

(deftest set-enabled-test
  (let [on-db {:repl-input/id "output-sidebar" :repl-input/enabled? true :repl-input/version 4}]
    (testing "unmounts and tells the extension when turned off"
      (is (= {:uf/db (assoc on-db :repl-input/enabled? false)
              :uf/fxs [[:repl-input/fx.unmount]
                       [:fx/post-to-host {:command "repl-input-unmounted" :repl-input/id "output-sidebar"}]]}
             (sut/handle-action on-db [:repl-input/ax.set-enabled false]))))
    (testing "does nothing when it already is as asked"
      (is (= {:uf/db on-db} (sut/handle-action on-db [:repl-input/ax.set-enabled true]))))))

(deftest changed-test
  (let [db {:repl-input/id "output-view" :repl-input/version 2}
        {new-db :uf/db fxs :uf/fxs} (sut/handle-action db [:repl-input/ax.changed {:text "(+ 1 2)" :selections [[7 7]]}])]
    (testing "bumps the version"
      (is (= 3 (:repl-input/version new-db))))
    (testing "posts the change with its version"
      (is (= [[:fx/post-to-host {:command "repl-input-changed" :repl-input/id "output-view"
                                 :version 3 :text "(+ 1 2)" :selections [[7 7]]}]]
             fxs)))))

(deftest focus-test
  (let [db {:repl-input/id "output-view"}]
    (is (= [[:fx/post-to-host {:command "repl-input-focused" :repl-input/id "output-view"}]]
           (:uf/fxs (sut/handle-action db [:repl-input/ax.focused]))))
    (is (= [[:fx/post-to-host {:command "repl-input-blurred" :repl-input/id "output-view"}]]
           (:uf/fxs (sut/handle-action db [:repl-input/ax.blurred]))))))

(deftest not-last-focused-test
  (is (= [[:repl-input/fx.forget-focus]]
         (:uf/fxs (sut/handle-action {:repl-input/id "output-view"} [:repl-input/ax.not-last-focused])))
      "forgets which element had the focus, so the view doesn't take the focus back for it"))

(deftest drag-test
  (let [db {:repl-input/id "output-view" :repl-input/height 100}]
    (testing "sets the height the sash is dragged to"
      (is (= {:uf/db (assoc db :repl-input/height 150)
              :uf/fxs [[:repl-input/fx.set-height 150]]}
             (sut/handle-action db [:repl-input/ax.drag {:height 150 :view-height 600}]))))
    (testing "keeps the height between the minimum and the view"
      (is (= sut/min-height (get-in (sut/handle-action db [:repl-input/ax.drag {:height 3 :view-height 600}]) [:uf/db :repl-input/height])))
      (is (= 560 (get-in (sut/handle-action db [:repl-input/ax.drag {:height 900 :view-height 600}]) [:uf/db :repl-input/height]))))
    (testing "keeps the height when the drag ends, and stores it"
      (is (= {:uf/db db
              :uf/fxs [[:fx/post-to-host {:command "repl-input-resized" :repl-input/id "output-view" :height 100}]]}
             (sut/handle-action db [:repl-input/ax.drag-ended]))))))

(deftest edit-test
  (let [db {:repl-input/id "output-view" :repl-input/version 2}
        edit {:repl-input/version 2 :text "(a b)" :selections [[4 4]]}]
    (testing "applies an edit of the REPL Input's version"
      (is (= {:uf/db db
              :uf/fxs [[:repl-input/fx.apply-edit {:text "(a b)" :selections [[4 4]]}]]}
             (sut/handle-action db [:repl-input/ax.edit edit]))))
    (testing "drops an edit of an older version, since the text changed after the command read it"
      (is (= {:uf/db (assoc db :repl-input/version 3)}
             (sut/handle-action (assoc db :repl-input/version 3) [:repl-input/ax.edit edit]))))))

(deftest set-command-keys-test
  (testing "keeps the command keys in comparable form and hands them to the editor"
    (let [{:uf/keys [db fxs]} (sut/handle-action {:repl-input/id "output-view"}
                                                 [:repl-input/ax.set-command-keys {:keys #{"shift+cmd+7"} :chords #{}}])]
      (is (= {:keys #{"shift+meta+7"} :chords #{}} (:repl-input/command-keys db)))
      (is (= [[:repl-input/fx.set-command-keys {:keys #{"shift+meta+7"} :chords #{}}]] fxs)))))

(deftest set-brackets-test
  (let [db {:repl-input/id "output-view" :repl-input/version 2}
        message {:repl-input/version 2 :repl-input/brackets {:brackets [[0 1 0] [2 3 0]] :matched [[0 1]]}}]
    (testing "marks the brackets computed for the REPL Input's version"
      (is (= {:uf/db db
              :uf/fxs [[:repl-input/fx.set-brackets [[0 1 "repl-input-bracket-0"]
                                                     [2 3 "repl-input-bracket-0"]
                                                     [0 1 "repl-input-matched-bracket"]]]]}
             (sut/handle-action db [:repl-input/ax.set-brackets message]))))
    (testing "drops brackets computed for another version"
      (is (= {:uf/db (assoc db :repl-input/version 3)}
             (sut/handle-action (assoc db :repl-input/version 3) [:repl-input/ax.set-brackets message]))))))

(deftest set-editor-settings-test
  (testing "hands the closing brackets, the bracket stylesheet, the editing settings and the completion settings to the editor"
    (let [{:uf/keys [fxs]} (sut/handle-action {:repl-input/id "output-view"}
                                              [:repl-input/ax.set-editor-settings
                                               {:close-brackets ["(" "\""]
                                                :bracket-styles {:bracket-colors ["#0098e6"]}
                                                :multi-cursor-modifier "ctrlCmd"
                                                :word-separators "()[]{}"
                                                :completion {:activate-on-typing? true :delay 10}}])]
      (is (= [[:repl-input/fx.set-close-brackets ["(" "\""]]
              [:repl-input/fx.set-bracket-css ".repl-input-bracket-0 { color: #0098e6; }\n"]
              [:repl-input/fx.set-editing {:multi-cursor-modifier "ctrlCmd" :word-separators "()[]{}"}]
              [:repl-input/fx.set-completion {:activate-on-typing? true :delay 10 :enabled? true}]]
             fxs)))))

(deftest run-command-test
  (testing "runs the command the extension names in the editor"
    (is (= {:uf/db {:repl-input/id "output-view"}
            :uf/fxs [[:repl-input/fx.run-command "joinLines"]]}
           (sut/handle-action {:repl-input/id "output-view"} [:repl-input/ax.run-command "joinLines"])))))

(def ^:private locked-line
  {:repl-input.context/ns "pirate.core"
   :repl-input.context/ns-form "(ns pirate.core)"
   :repl-input.context/session-key "clj"
   :repl-input.context/locked? true
   :repl-input.context/connected? true})

(deftest context-line-test
  (let [db {:repl-input/id "output-view"}]
    (testing "shows the context line the extension posts"
      (is (= {:uf/db (assoc db :repl-input/context-line locked-line)
              :uf/fxs [[:repl-input/fx.set-context-line locked-line nil]]}
             (sut/handle-action db [:repl-input/ax.set-context-line locked-line]))))
    (testing "asks the extension to connect a REPL on a click on the connect link"
      (is (= {:uf/db db
              :uf/fxs [[:fx/post-to-host {:command "repl-input-connect" :repl-input/id "output-view"}]]}
             (sut/handle-action db [:repl-input/ax.connect]))))))

(deftest follow-editor-test
  (let [db {:repl-input/id "output-view"}]
    (testing "asks the extension to follow the editor while locked"
      (is (= [[:fx/post-to-host {:command "repl-input-follow-editor" :repl-input/id "output-view"}]]
             (:uf/fxs (sut/handle-action (assoc db :repl-input/context-line locked-line) [:repl-input/ax.follow-editor])))))
    (testing "asks for nothing while following the editor, or before the extension has posted the context line"
      (let [following (assoc-in db [:repl-input/context-line :repl-input.context/locked?] false)]
        (is (= {:uf/db following} (sut/handle-action following [:repl-input/ax.follow-editor])))
        (is (= {:uf/db db} (sut/handle-action db [:repl-input/ax.follow-editor])))))))

(deftest evaluate-test
  (let [db {:repl-input/id "output-sidebar" :repl-input/context-line locked-line}]
    (testing "asks the extension to evaluate this REPL Input on a click on the play button"
      (is (= {:uf/db db
              :uf/fxs [[:fx/post-to-host {:command "repl-input-evaluate" :repl-input/id "output-sidebar"}]]}
             (sut/handle-action db [:repl-input/ax.evaluate]))))
    (testing "does nothing while no session answers to the context, or before the extension has posted the context line"
      (let [not-connected (assoc-in db [:repl-input/context-line :repl-input.context/connected?] false)
            no-line (dissoc db :repl-input/context-line)]
        (is (= {:uf/db not-connected} (sut/handle-action not-connected [:repl-input/ax.evaluate])))
        (is (= {:uf/db no-line} (sut/handle-action no-line [:repl-input/ax.evaluate])))))))

(deftest evaluation-test
  (let [db {:repl-input/id "output-view" :repl-input/completion-settings {:delay 10}}]
    (testing "shows the evaluation bar the extension posts"
      (is (= {:uf/db (assoc db :repl-input/evaluation :running)
              :uf/fxs [[:repl-input/fx.set-evaluation :running]]}
             (sut/handle-action db [:repl-input/ax.set-evaluation :running]))))
    (testing "shows the stdin input when an evaluation starts reading stdin, and keeps completion on"
      (is (= {:uf/db (assoc db :repl-input/evaluation :reading-stdin)
              :uf/fxs [[:repl-input/fx.set-evaluation :reading-stdin]
                       [:repl-input/fx.show-stdin]]}
             (sut/handle-action (assoc db :repl-input/evaluation :running) [:repl-input/ax.set-evaluation :reading-stdin]))))
    (testing "leaves the stdin input be while the evaluation still reads stdin"
      (is (= [[:repl-input/fx.set-evaluation :reading-stdin]]
             (:uf/fxs (sut/handle-action (assoc db :repl-input/evaluation :reading-stdin)
                                         [:repl-input/ax.set-evaluation :reading-stdin])))))
    (testing "hides the stdin input when the line is sent, or the evaluation ends"
      (is (= [[:repl-input/fx.set-evaluation :running]
              [:repl-input/fx.hide-stdin]]
             (:uf/fxs (sut/handle-action (assoc db :repl-input/evaluation :reading-stdin)
                                         [:repl-input/ax.set-evaluation :running]))))
      (is (= [:repl-input/fx.hide-stdin]
             (last (:uf/fxs (sut/handle-action (assoc db :repl-input/evaluation :reading-stdin)
                                               [:repl-input/ax.set-evaluation nil]))))))
    (testing "asks the extension to interrupt"
      (is (= [[:fx/post-to-host {:command "repl-input-interrupt" :repl-input/id "output-view"}]]
             (:uf/fxs (sut/handle-action db [:repl-input/ax.interrupt])))))))

(deftest stdin-test
  (let [db {:repl-input/id "output-sidebar"}]
    (testing "sends the line from the stdin input to the extension"
      (is (= [[:fx/post-to-host {:command "repl-input-send-line" :repl-input/id "output-sidebar" :line "Ahoy"}]]
             (:uf/fxs (sut/handle-action db [:repl-input/ax.send-line "Ahoy"])))))
    (testing "focuses the stdin input while an evaluation reads stdin, else the REPL Input"
      (is (= [[:repl-input/fx.focus-stdin]]
             (:uf/fxs (sut/handle-action (assoc db :repl-input/evaluation :reading-stdin) [:repl-input/ax.focus]))))
      (is (= [[:repl-input/fx.focus]]
             (:uf/fxs (sut/handle-action (assoc db :repl-input/evaluation :running) [:repl-input/ax.focus])))))
    (testing "forgets the evaluation when turned off, so that turning on again shows the stdin input again"
      (is (nil? (-> (assoc db :repl-input/enabled? true :repl-input/evaluation :reading-stdin)
                    (sut/handle-action [:repl-input/ax.set-enabled false])
                    :uf/db
                    :repl-input/evaluation))))))

(def ^:private pirate-entry
  {:repl-input.history/code "(def a 1)"
   :repl-input.context/ns "pirate.core"
   :repl-input.context/ns-form "(ns pirate.core)"
   :repl-input.context/session-key "clj"})

(def ^:private following-line
  {:repl-input.context/ns "user"
   :repl-input.context/ns-form "(in-ns 'user)"
   :repl-input.context/session-key "clj"
   :repl-input.context/locked? false})

(deftest walk-history-test
  (let [db {:repl-input/id "output-view"
            :repl-input/text "(draft"
            :repl-input/selections [[2 2]]
            :repl-input/context-line following-line
            :repl-input.history/entries [pirate-entry]}
        {walked :uf/db fxs :uf/fxs} (sut/handle-action db [:repl-input/ax.walk-history :back])
        entry-lock (dissoc pirate-entry :repl-input.history/code)
        entry-line (assoc entry-lock :repl-input.context/locked? true :repl-input.context/editor-ns "user")
        caught-up (assoc walked :repl-input/context-line entry-line)]
    (testing "walks the history in the page, showing the entry with the cursor at its start, and locks the namespace and session of an entry from another context"
      (is (= [[:repl-input/fx.apply-edit {:text "(def a 1)" :selections [[0 0]]}]
              [:repl-input/fx.set-context-line following-line nil]
              [:fx/post-to-host {:command "repl-input-lock" :repl-input/id "output-view" :lock entry-lock}]]
             fxs)))
    (testing "shows the entry's lock as recalled once the context line is locked to it"
      (is (= [[:repl-input/fx.set-context-line entry-line entry-lock]]
             (:uf/fxs (sut/handle-action walked [:repl-input/ax.set-context-line entry-line])))))
    (testing "walking past the newest entry brings back the text, with the cursor at its end, and follows the editor again, as before the walk"
      (is (= [[:repl-input/fx.apply-edit {:text "(draft" :selections [[6 6]]}]
              [:repl-input/fx.set-context-line entry-line nil]
              [:fx/post-to-host {:command "repl-input-follow-editor" :repl-input/id "output-view"}]]
             (:uf/fxs (sut/handle-action caught-up [:repl-input/ax.walk-history :forward])))))
    (testing "walking past the newest entry brings back the lock from before the walk"
      (let [locked-db (assoc db :repl-input/context-line locked-line :repl-input.history/entries [(assoc pirate-entry :repl-input.context/ns "pirate.ui")])
            walked-locked (:uf/db (sut/handle-action locked-db [:repl-input/ax.walk-history :back]))]
        (is (= [:fx/post-to-host {:command "repl-input-lock" :repl-input/id "output-view"
                                  :lock (select-keys locked-line [:repl-input.context/ns :repl-input.context/ns-form :repl-input.context/session-key])}]
               (last (:uf/fxs (sut/handle-action walked-locked [:repl-input/ax.walk-history :forward])))))))
    (testing "does nothing where there is nowhere to walk"
      (is (= {:uf/db db} (sut/handle-action db [:repl-input/ax.walk-history :forward]))))
    (testing "a new history from the extension ends the walk, and keeps the lock"
      (let [{new-db :uf/db new-fxs :uf/fxs} (sut/handle-action caught-up [:repl-input/ax.set-history [pirate-entry pirate-entry]])]
        (is (nil? (:repl-input.history/position new-db)))
        (is (= [[:repl-input/fx.set-context-line entry-line nil]] new-fxs))))
    (testing "shows the entry that the history search picked"
      (is (= [:repl-input/fx.apply-edit {:text "(def a 1)" :selections [[9 9]]}]
             (first (:uf/fxs (sut/handle-action db [:repl-input/ax.recall 0]))))))))

(deftest namespace-indicator-test
  (let [db {:repl-input/id "output-view" :repl-input/text "" :repl-input.history/entries [pirate-entry]}
        following (assoc db :repl-input/context-line following-line)
        locked (assoc db :repl-input/context-line locked-line)
        recalled (-> (sut/handle-action following [:repl-input/ax.walk-history :back])
                     :uf/db
                     (assoc :repl-input/context-line locked-line))]
    (testing "does nothing on a click while following the editor"
      (is (= {:uf/db following} (sut/handle-action following [:repl-input/ax.click-namespace-indicator]))))
    (testing "follows the editor on a click while locked"
      (is (= [[:fx/post-to-host {:command "repl-input-follow-editor" :repl-input/id "output-view"}]]
             (:uf/fxs (sut/handle-action locked [:repl-input/ax.click-namespace-indicator])))))
    (testing "opens or closes the menu on a click while locked by a recalled history entry, and its other choice follows the editor"
      (is (= [[:repl-input/fx.toggle-namespace-menu]]
             (:uf/fxs (sut/handle-action recalled [:repl-input/ax.click-namespace-indicator]))))
      (is (= [[:fx/post-to-host {:command "repl-input-follow-editor" :repl-input/id "output-view"}]]
             (:uf/fxs (sut/handle-action recalled [:repl-input/ax.follow-editor])))))))

(deftest completion-test
  (let [db {:repl-input/id "output-view"}]
    (testing "asks the extension to complete, and for a candidate's docs"
      (is (= [[:fx/post-to-host {:command "repl-input-complete" :repl-input/id "output-view"
                                 :request 4 :text "(str" :offset 4 :explicit? false}]]
             (:uf/fxs (sut/handle-action db [:repl-input/ax.complete {:request 4 :text "(str" :offset 4 :explicit? false}]))))
      (is (= [[:fx/post-to-host {:command "repl-input-resolve-completion" :repl-input/id "output-view" :request 4 :index 2}]]
             (:uf/fxs (sut/handle-action db [:repl-input/ax.resolve-completion {:request 4 :index 2}])))))
    (testing "hands the extension's answers to the editor"
      (is (= [[:repl-input/fx.deliver-completions {:repl-input.completion/request 4}]]
             (:uf/fxs (sut/handle-action db [:repl-input/ax.completions {:repl-input.completion/request 4}]))))
      (is (= [[:repl-input/fx.deliver-completion-docs {:repl-input.completion/request 4}]]
             (:uf/fxs (sut/handle-action db [:repl-input/ax.completion-docs {:repl-input.completion/request 4}])))))
    (testing "tells the extension when the list opens and closes, and only then"
      (let [{opened :uf/db fxs :uf/fxs} (sut/handle-action db [:repl-input/ax.completion-active true])]
        (is (= [[:fx/post-to-host {:command "repl-input-completion-active" :repl-input/id "output-view" :active? true}]]
               fxs))
        (is (= {:uf/db opened} (sut/handle-action opened [:repl-input/ax.completion-active true])))
        (is (= [[:fx/post-to-host {:command "repl-input-completion-active" :repl-input/id "output-view" :active? false}]]
               (:uf/fxs (sut/handle-action opened [:repl-input/ax.completion-active false]))))
        (is (= {:uf/db db} (sut/handle-action db [:repl-input/ax.completion-active false])))))))

(deftest reveal-definition-test
  (testing "a go to definition click asks the extension for the definition at its offset in its text"
    (is (= [[:fx/post-to-host {:command "repl-input-reveal-definition" :repl-input/id "output-sidebar"
                               :text "(f 1)" :offset 1}]]
           (:uf/fxs (sut/handle-action {:repl-input/id "output-sidebar"}
                                       [:repl-input/ax.reveal-definition {:text "(f 1)" :offset 1}]))))))

(deftest take-focus-test
  (testing "takes the focus when the extension asks, as when an evaluation from a file waits for a line"
    (is (= [[:repl-input/fx.focus]]
           (:uf/fxs (sut/handle-action {:repl-input/id "output-sidebar"} [:repl-input/ax.focus]))))))
