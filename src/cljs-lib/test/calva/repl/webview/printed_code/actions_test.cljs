(ns calva.repl.webview.printed-code.actions-test
  (:require
   [calva.repl.webview.printed-code.actions :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def db {:repl-input/id "output-view" :printed-code/editor 4 :printed-code/version 2})

(defn- post
  [command & {:as more}]
  [:fx/post-to-host (merge {:command command :repl-input/id "output-view"} more)])

(deftest clicked-test
  (is (= {:uf/db (assoc db :printed-code/editor 5 :printed-code/version 3)
          :uf/fxs [[:printed-code/fx.mount {:code :the-code :selections [[3 3]]}]]}
         (sut/handle-action db [:printed-code/ax.clicked {:code :the-code :selections [[3 3]]}]))
      "A click mounts a new editor, so answers for an earlier editor don't match it")
  (is (= [1 1] ((juxt :printed-code/editor :printed-code/version) (:uf/db (sut/handle-action {} [:printed-code/ax.clicked {}]))))
      "The first editor in the page starts the counts"))

(deftest focus-and-changes-test
  (is (= [(post "printed-code-focused" :editor 4 :version 2 :text "(a)" :selections [[1 1]])]
         (:uf/fxs (sut/handle-action db [:printed-code/ax.focused {:text "(a)" :selections [[1 1]]}])))
      "Focus tells the extension the text and the selections of the editor at the current version")
  (let [{changed-db :uf/db :uf/keys [fxs]} (sut/handle-action db [:printed-code/ax.changed {:selections [[0 3]]}])]
    (is (= 3 (:printed-code/version changed-db))
        "A selection change is a new version")
    (is (= [(post "printed-code-changed" :version 3 :selections [[0 3]])] fxs)
        "The extension gets the selections at the new version"))
  (is (= [(post "printed-code-blurred")]
         (:uf/fxs (sut/handle-action db [:printed-code/ax.blurred]))))
  (let [{unmounted-db :uf/db :uf/keys [fxs]} (sut/handle-action db [:printed-code/ax.unmounted])]
    (is (= db unmounted-db)
        "The version stays, for the next editor to count on from")
    (is (= [(post "printed-code-unmounted") [:fx/release-kept-colors]] fxs)
        "The block the editor was in can lose its colors once it is far from the view")))

(deftest from-the-extension-test
  (testing "selections and brackets apply only to the editor and the version they were made from"
    (is (= [[:printed-code/fx.set-selections [[0 3]]]]
           (:uf/fxs (sut/handle-action db [:printed-code/ax.select {:editor 4 :version 2 :selections [[0 3]]}]))))
    (is (nil? (:uf/fxs (sut/handle-action db [:printed-code/ax.select {:editor 4 :version 1 :selections [[0 3]]}]))))
    (is (nil? (:uf/fxs (sut/handle-action db [:printed-code/ax.select {:editor 3 :version 2 :selections [[0 3]]}])))
        "An answer for an earlier editor at the same version")
    (is (= [[:printed-code/fx.set-marks [[0 1 "code-bracket-0"] [2 3 "code-bracket-0"] [0 1 "code-matched-bracket"]]]
            [:printed-code/fx.set-forms [[0 1 0] [2 3 0]]]]
           (:uf/fxs (sut/handle-action db [:printed-code/ax.set-brackets {:editor 4
                                                                         :version 2
                                                                         :brackets {:brackets [[0 1 0] [2 3 0]]
                                                                                    :matched [[0 1]]}}]))))
    (is (nil? (:uf/fxs (sut/handle-action db [:printed-code/ax.set-brackets {:editor 4 :version 3 :brackets {}}])))))
  (is (= [[:printed-code/fx.set-command-keys {:keys #{"ctrl+alt+right"} :chords #{}}]]
         (:uf/fxs (sut/handle-action db [:printed-code/ax.set-command-keys {:keys ["Ctrl+Alt+Right"] :chords []}])))
      "The command keys are matched as the REPL Input matches them"))
