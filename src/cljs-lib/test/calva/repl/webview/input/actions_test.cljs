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
