(ns calva.repl.webview.input.keys-test
  (:require
   [calva.repl.webview.input.keys :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest key-id-test
  (testing "modifiers in one order, with VS Code's names for the platform's modifier keys"
    (is (= "shift+meta+7" (sut/key-id "shift+cmd+7")))
    (is (= "ctrl+shift+[comma]" (sut/key-id "Shift+Ctrl+[Comma]")))
    (is (= "alt+meta+/" (sut/key-id "cmd+alt+/")))
    (is (= "meta+k" (sut/key-id "win+k")))))

(def command-keys
  (sut/command-keys {:keys #{"shift+cmd+7" "shift+[Comma]" "ctrl+w" "backspace" "alt+right" "ctrl+alt+c"}
                     :chords #{"ctrl+alt+c"}}))

(defn- keydown
  ([event] (keydown false event))
  ([pending-chord? event]
   (sut/keydown command-keys pending-chord? (merge {:ctrl? false :shift? false :alt? false :meta? false} event))))

(deftest keydown-test
  (testing "leaves a Calva command's key to VS Code, matched by the key VS Code resolved for the keyboard layout"
    (is (= {:cancel? true :pending-chord? false}
           (keydown {:key "/" :code "Digit7" :shift? true :meta? true})))
    (is (:cancel? (keydown {:key ";" :code "Comma" :shift? true})))
    (is (:cancel? (keydown {:key "w" :code "KeyW" :ctrl? true})))
    (is (:cancel? (keydown {:key "Backspace" :code "Backspace"})))
    (is (:cancel? (keydown {:key "ArrowRight" :code "ArrowRight" :alt? true}))))
  (testing "handles the other keys in the REPL Input"
    (is (= {:cancel? false :pending-chord? false}
           (keydown {:key "w" :code "KeyW"})))
    (is (not (:cancel? (keydown {:key "ArrowRight" :code "ArrowRight"})))))
  (testing "leaves a chord's first key to VS Code, and the key after it"
    (is (= {:cancel? true :pending-chord? true}
           (keydown {:key "c" :code "KeyC" :ctrl? true :alt? true})))
    (is (= {:cancel? true :pending-chord? false}
           (keydown true {:key "j" :code "KeyJ" :ctrl? true :alt? true}))))
  (testing "modifier keys alone change nothing"
    (is (= {:cancel? false :pending-chord? true}
           (keydown true {:key "Control" :code "ControlLeft" :ctrl? true}))))
  (testing "leaves keys alone while composing"
    (is (not (:cancel? (keydown {:key "Backspace" :code "Backspace" :composing? true}))))))

(deftest keydown-completion-list-test
  (let [keys (sut/command-keys {:keys #{"tab" "enter" "backspace"}
                                :chords #{}
                                :completion-list-keys #{"backspace"}})
        keydown (fn [event] (sut/keydown keys false (merge {:ctrl? false :shift? false :alt? false :meta? false} event)))]
    (testing "leaves `tab` and `enter` to VS Code while the completion list is closed"
      (is (:cancel? (keydown {:key "Tab" :code "Tab"})))
      (is (:cancel? (keydown {:key "Enter" :code "Enter"}))))
    (testing "gives CodeMirror the keys whose bindings step aside while the list is open"
      (is (not (:cancel? (keydown {:key "Tab" :code "Tab" :completion-list? true}))))
      (is (not (:cancel? (keydown {:key "Enter" :code "Enter" :completion-list? true}))))
      (is (:cancel? (keydown {:key "Backspace" :code "Backspace" :completion-list? true}))))))
