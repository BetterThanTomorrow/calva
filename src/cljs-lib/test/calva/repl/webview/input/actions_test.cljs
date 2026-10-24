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

(deftest drag-test
  (let [db {:repl-input/id "output-view" :repl-input/height 100}]
    (testing "follows the drag while dragging"
      (is (= {:uf/db (assoc db :repl-input/height 150)
              :uf/fxs [[:repl-input/fx.set-height {:height 150 :dragging? true}]]}
             (sut/handle-action db [:repl-input/ax.drag {:height 150 :view-height 600}]))))
    (testing "keeps the height between the minimum and the view"
      (is (= sut/min-height (get-in (sut/handle-action db [:repl-input/ax.drag {:height 3 :view-height 600}]) [:uf/db :repl-input/height])))
      (is (= 560 (get-in (sut/handle-action db [:repl-input/ax.drag {:height 900 :view-height 600}]) [:uf/db :repl-input/height]))))
    (testing "stores the height when the drag ends"
      (is (= [[:repl-input/fx.set-height {:height 100 :dragging? false}]
              [:fx/post-to-host {:command "repl-input-resized" :repl-input/id "output-view" :height 100}]]
             (:uf/fxs (sut/handle-action db [:repl-input/ax.drag-ended])))))))

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
   :repl-input.context/session "clj"
   :repl-input.context/hint "locked · click to follow the editor"
   :repl-input.context/locked? true
   :repl-input.context/connected? true})

(deftest context-line-test
  (let [db {:repl-input/id "output-view"}]
    (testing "shows the context line the extension posts"
      (is (= {:uf/db (assoc db :repl-input/context-line locked-line)
              :uf/fxs [[:repl-input/fx.set-context-line locked-line]]}
             (sut/handle-action db [:repl-input/ax.set-context-line locked-line]))))
    (testing "asks the extension to follow the editor on a click while locked"
      (is (= [[:fx/post-to-host {:command "repl-input-follow-editor" :repl-input/id "output-view"}]]
             (:uf/fxs (sut/handle-action (assoc db :repl-input/context-line locked-line) [:repl-input/ax.follow-editor])))))
    (testing "does nothing on a click while following the editor"
      (is (= {:uf/db (assoc db :repl-input/context-line (assoc locked-line :repl-input.context/locked? false))}
             (sut/handle-action (assoc db :repl-input/context-line (assoc locked-line :repl-input.context/locked? false))
                                [:repl-input/ax.follow-editor]))))))

(deftest evaluation-test
  (let [db {:repl-input/id "output-view" :repl-input/completion-settings {:delay 10}}]
    (testing "shows the evaluation bar the extension posts, and turns completion off while it reads stdin"
      (is (= {:uf/db (assoc db :repl-input/evaluation :reading-stdin)
              :uf/fxs [[:repl-input/fx.set-evaluation :reading-stdin]
                       [:repl-input/fx.set-completion {:delay 10 :enabled? false}]]}
             (sut/handle-action db [:repl-input/ax.set-evaluation :reading-stdin]))))
    (testing "turns completion on again when the evaluation is done"
      (is (= [:repl-input/fx.set-completion {:delay 10 :enabled? true}]
             (last (:uf/fxs (sut/handle-action (assoc db :repl-input/evaluation :reading-stdin)
                                               [:repl-input/ax.set-evaluation nil]))))))
    (testing "asks the extension to interrupt"
      (is (= [[:fx/post-to-host {:command "repl-input-interrupt" :repl-input/id "output-view"}]]
             (:uf/fxs (sut/handle-action db [:repl-input/ax.interrupt])))))))

(deftest walk-history-test
  (testing "asks the extension to walk the history"
    (is (= [[:fx/post-to-host {:command "repl-input-walk-history" :repl-input/id "output-view" :direction "back"}]]
           (:uf/fxs (sut/handle-action {:repl-input/id "output-view"} [:repl-input/ax.walk-history :back]))))))

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

(deftest reveal-evaluation-test
  (let [db {:repl-input/id "output-sidebar"}]
    (testing "reveals the evaluated code block the extension asks for"
      (let [payload {:request 3 :repl-input.evaluation/id 41 :line 2 :column 3}]
        (is (= [[:fx/reveal-evaluated-code payload]]
               (:uf/fxs (sut/handle-action db [:repl-input/ax.reveal-evaluation payload]))))))
    (testing "tells the extension whether the view has the block"
      (is (= [[:fx/post-to-host {:command "repl-input-evaluation-revealed" :repl-input/id "output-sidebar"
                                 :request 3 :found? true}]]
             (:uf/fxs (sut/handle-action db [:repl-input/ax.evaluation-revealed {:request 3 :found? true}])))))))
