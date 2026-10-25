(ns calva.repl.webview.input.context-test
  (:require
   [calva.repl.webview.input.context :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def ^:private following-line
  {:repl-input.context/ns "user"
   :repl-input.context/ns-form "(in-ns 'user)"
   :repl-input.context/session-key "clj"
   :repl-input.context/locked? false})

(def ^:private pirate-lock
  {:repl-input.context/ns "pirate.ui"
   :repl-input.context/ns-form "(ns pirate.ui)"
   :repl-input.context/session-key "cljs"})

(deftest mode-button-test
  (testing "shows the link while following the editor, and says that a click, or an ns or in-ns form, locks"
    (is (= {:repl-input.mode/icon :link
            :repl-input.mode/entry? false
            :repl-input.mode/title "Following the editor. Click to lock the namespace and session. Evaluating an ns or in-ns form locks too."}
           (sut/mode-button following-line nil))))
  (testing "shows the link for a history entry from another context, and names the entry's namespace and session"
    (is (= {:repl-input.mode/icon :link
            :repl-input.mode/entry? true
            :repl-input.mode/title "Following the editor. Click to lock the history entry's namespace and session: pirate.ui · cljs"}
           (sut/mode-button following-line pirate-lock))))
  (testing "shows the lock while locked, and says that a click follows the editor"
    (is (= {:repl-input.mode/icon :lock
            :repl-input.mode/entry? false
            :repl-input.mode/title "Locked. Click to follow the editor."}
           (sut/mode-button (assoc following-line :repl-input.context/locked? true) nil)))))
