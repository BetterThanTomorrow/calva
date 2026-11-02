(ns calva.repl.input.command-keys-test
  (:require
   [calva.repl.input.command-keys :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def manifest-keybindings
  [{:command "calva.toggleLineComment"
    :key "ctrl+/"
    :mac "cmd+/"
    :when "calva:keybindingsEnabled && config.calva.paredit.hijackVSCodeDefaults && (editorLangId == clojure && editorTextFocus || calva:replInputFocused) && !editorReadOnly"}
   {:command "paredit.sexpRangeExpansion"
    :mac "ctrl+w"
    :win "shift+alt+right"
    :linux "shift+alt+right"
    :when "calva:keybindingsEnabled && (editorLangId == clojure && editorTextFocus || calva:replInputFocused) && paredit:keyMap =~ /original|strict/ && !calva:cursorInComment"}
   {:command "paredit.forwardSexp"
    :mac "ctrl+right"
    :win "alt+right"
    :linux "alt+right"
    :when "calva:keybindingsEnabled && (editorLangId == clojure && editorTextFocus || calva:replInputFocused) && paredit:keyMap =~ /original|strict/ && !config.calva.paredit.hijackVSCodeDefaults && !calva:cursorInComment || calva:cursorAfterComment"}
   {:command "paredit.forwardSexp"
    :mac "alt+right"
    :win "ctrl+right"
    :linux "ctrl+right"
    :when "calva:keybindingsEnabled && (editorLangId == clojure && editorTextFocus || calva:replInputFocused) && paredit:keyMap =~ /original|strict/ && config.calva.paredit.hijackVSCodeDefaults && !calva:cursorInComment || calva:cursorAfterComment"}
   {:command "calva.replInput.deleteBackward"
    :key "backspace"
    :when "calva:keybindingsEnabled && calva:replInputFocused && paredit:keyMap == strict && !editorHasMultipleSelections && !calva:cursorInComment"}
   {:command "calva.evaluateSelection"
    :key "ctrl+enter"
    :when "calva:keybindingsEnabled && editorLangId == clojure && editorTextFocus && !suggestWidgetVisible"}
   {:command "calva.jackIn"
    :key "ctrl+alt+c ctrl+alt+j"
    :when "calva:keybindingsEnabled"}
   {:command "calva.runCustomREPLCommand"
    :key "ctrl+alt+space a"
    :when "calva:connected && calva:keybindingsEnabled"}])

(def resolved-keybindings
  [{:command "calva.toggleLineComment"
    :key "shift+cmd+7"
    :when "calva:keybindingsEnabled && config.calva.paredit.hijackVSCodeDefaults && editorLangId == 'clojure' && editorTextFocus && !editorReadOnly || calva:keybindingsEnabled && config.calva.paredit.hijackVSCodeDefaults && calva:replInputFocused && !editorReadOnly"}
   {:command "editor.action.commentLine"
    :key "cmd+/"
    :when "editorTextFocus && !editorReadOnly"}])

(def settings
  {"calva.keybindingsEnabled" true
   "calva.paredit.defaultKeyMap" "strict"
   "calva.paredit.hijackVSCodeDefaults" true})

(def record
  {:repl-input/id "output-view"
   :repl-input/version 3
   :repl-input/text "(a b)"
   :repl-input/selections [[3 3]]
   :repl-input/cursor-contexts {"calva:cursorInComment" false
                                "calva:cursorAfterComment" false}})

(def mac-keybindings
  (sut/parsed (sut/platform-keybindings manifest-keybindings "mac")))

(defn- keys-for
  ([settings] (keys-for settings record))
  ([settings record]
   (sut/command-keys mac-keybindings (sut/context {:repl-input/settings settings} record))))

(deftest command-keys-test
  (testing "keys bound to Calva commands whose when clauses hold while the REPL Input has focus"
    (is (= {:keys #{"cmd+/" "ctrl+w" "alt+right" "backspace" "ctrl+alt+c"} :chords #{"ctrl+alt+c"}}
           (keys-for settings))))
  (testing "follows the settings"
    (is (= #{"ctrl+w" "ctrl+right" "ctrl+alt+c"}
           (:keys (keys-for (assoc settings
                                   "calva.paredit.hijackVSCodeDefaults" false
                                   "calva.paredit.defaultKeyMap" "original")))))
    (is (= {:keys #{} :chords #{}}
           (keys-for (assoc settings "calva.keybindingsEnabled" false)))))
  (testing "follows the cursor contexts and the selections of the REPL Input"
    (is (= #{"cmd+/" "ctrl+alt+c"}
           (:keys (keys-for settings (assoc-in record [:repl-input/cursor-contexts "calva:cursorInComment"] true)))))
    (is (= #{"cmd+/" "ctrl+w" "alt+right" "ctrl+alt+c"}
           (:keys (keys-for settings (assoc record :repl-input/selections [[1 1] [3 3]]))))))
  (testing "follows the REPL connection"
    (is (= {:keys #{"cmd+/" "ctrl+w" "alt+right" "backspace" "ctrl+alt+c" "ctrl+alt+space"}
            :chords #{"ctrl+alt+c" "ctrl+alt+space"}}
           (sut/command-keys mac-keybindings
                             (sut/context {:repl-input/settings settings :repl-input/connected? true} record))))))

(deftest focused-context-test
  (let [keybindings (sut/parsed [{:command "paredit.forwardSexp" :key "ctrl+alt+right"
                                  :when "calva:replInputFocused || calva:printedCodeFocused"}
                                 {:command "paredit.slurpSexpForward" :key "ctrl+alt+."
                                  :when "calva:replInputFocused"}])]
    (is (= #{"ctrl+alt+right" "ctrl+alt+."}
           (:keys (sut/command-keys keybindings (sut/context {:repl-input/settings {}} record))))
        "The REPL Input has focus by default")
    (is (= #{"ctrl+alt+right"}
           (:keys (sut/command-keys keybindings (sut/context {:repl-input/settings {}} record "calva:printedCodeFocused"))))
        "Printed code has the keys whose when clauses hold with its own context key")))

(deftest calva-keybindings-test
  (testing "VS Code's resolved keybindings for the manifest's commands, with the keys resolved for the keyboard layout"
    (is (= [(first resolved-keybindings)]
           (sut/calva-keybindings manifest-keybindings resolved-keybindings))))
  (testing "resolved when clauses evaluate as the manifest's do"
    (is (= #{"shift+cmd+7"}
           (:keys (sut/command-keys (sut/parsed (sut/calva-keybindings manifest-keybindings resolved-keybindings))
                                    (sut/context {:repl-input/settings settings} record)))))))

(def commands
  (set (map :command manifest-keybindings)))

(deftest with-user-keybindings-test
  (let [defaults (sut/platform-keybindings manifest-keybindings "mac")]
    (testing "the user's keybindings of Calva's commands join the defaults, others don't"
      (is (= (conj (vec defaults) {:key "shift+alt+right" :command "paredit.forwardSexp" :when "editorTextFocus"})
             (sut/with-user-keybindings defaults commands
               [{:key "shift+alt+right" :command "paredit.forwardSexp" :when "editorTextFocus" :args {:a 1}}
                {:key "ctrl+q" :command "workbench.action.quit"}
                {:command "paredit.forwardSexp"}]))))
    (testing "a `-<command>` entry with a key removes the default binding with that key, written in any modifier order"
      (is (= ["ctrl+right"]
             (->> (sut/with-user-keybindings defaults commands [{:key "Option+Right" :command "-paredit.forwardSexp"}])
                  (filter (comp #{"paredit.forwardSexp"} :command))
                  (map :key)))))
    (testing "a `-<command>` entry without a key removes every default binding of the command"
      (is (= []
             (->> (sut/with-user-keybindings defaults commands [{:command "-paredit.forwardSexp"}])
                  (filter (comp #{"paredit.forwardSexp"} :command))))))
    (testing "a removal of a chord compares each key of it"
      (is (= ["ctrl+alt+c ctrl+alt+j"]
             (->> (sut/with-user-keybindings defaults commands [{:key "ctrl+alt+c ctrl+alt+k" :command "-calva.jackIn"}
                                                                {:key "alt+ctrl+space a" :command "-calva.runCustomREPLCommand"}])
                  (filter (comp #{"calva.jackIn" "calva.runCustomREPLCommand"} :command))
                  (map :key)))))
    (testing "a removal's key removes the bindings whose chords start with it"
      (is (= []
             (->> (sut/with-user-keybindings defaults commands [{:key "ctrl+alt+c" :command "-calva.jackIn"}])
                  (filter (comp #{"calva.jackIn"} :command))))))
    (testing "a removal matches by its key, whatever its when clause"
      (is (= ["ctrl+right"]
             (->> (sut/with-user-keybindings defaults commands
                    [{:key "alt+right" :command "-paredit.forwardSexp"
                      :when "calva:replInputFocused && calva:keybindingsEnabled"}])
                  (filter (comp #{"paredit.forwardSexp"} :command))
                  (map :key)))))
    (testing "a keybinding that VS Code can't read changes nothing"
      (is (= (vec defaults)
             (sut/with-user-keybindings defaults commands
               [{:key "shift+alt+right" :command "paredit.forwardSexp" :when "editorTextFocus &&"}
                {:key "shift+alt+left" :command "paredit.forwardSexp" :when 1}
                {:key 1 :command "-paredit.forwardSexp" :when "editorTextFocus &&"}
                {:key ["alt+right"] :command "-paredit.forwardSexp"}]))))
    (testing "a user's keybinding holds in the REPL Input when its when clause does"
      (is (= #{"shift+alt+right"}
             (:keys (sut/command-keys (sut/parsed (sut/with-user-keybindings [] commands
                                                    [{:key "shift+alt+right" :command "paredit.forwardSexp"
                                                      :when "calva:replInputFocused || editorTextFocus"}
                                                     {:key "shift+alt+left" :command "paredit.forwardSexp"
                                                      :when "editorTextFocus && editorLangId == 'clojure'"}]))
                                      (sut/context {:repl-input/settings settings} record))))))))

(deftest output-views-custom-keybindings-test
  (let [user [{:key "shift+alt+right" :command "paredit.forwardSexp"
               :when "editorTextFocus && editorLangId == 'clojure'"}
              {:key "ctrl+alt+right" :command "paredit.forwardSexp"
               :when "editorTextFocus || calva:printedCodeFocused"}
              {:key "ctrl+alt+left" :command "paredit.forwardSexp"}
              {:key "ctrl+enter" :command "calva.evaluateSelection"
               :when "editorTextFocus"}
              {:key "ctrl+q" :command "workbench.action.quit"
               :when "editorTextFocus"}
              {:key "shift+alt+right" :command "-paredit.forwardSexp"
               :when "editorTextFocus"}
              {:command "paredit.forwardSexp"}]
        calva-when (:when (nth manifest-keybindings 2))]
    (is (= [{:key "shift+alt+right" :command "paredit.forwardSexp"
             :when "editorTextFocus && editorLangId == 'clojure'"
             :calva-when calva-when :reaches-output-views? false}
            {:key "ctrl+alt+right" :command "paredit.forwardSexp"
             :when "editorTextFocus || calva:printedCodeFocused"
             :calva-when calva-when :reaches-output-views? true}
            {:key "ctrl+alt+left" :command "paredit.forwardSexp"
             :calva-when calva-when :reaches-output-views? true}]
           (sut/output-views-custom-keybindings manifest-keybindings user))
        "Only keybindings with a key, of commands the Output views handle, each with the when clause of Calva's first binding of the command, and whether its own when clause reaches the Output views or is left out")))

(deftest platform-keybindings-test
  (testing "the manifest's keys for the platform, for when VS Code's resolved keybindings can't be read"
    (is (= ["cmd+/" "ctrl+w" "ctrl+right" "alt+right" "backspace" "ctrl+enter" "ctrl+alt+c ctrl+alt+j" "ctrl+alt+space a"]
           (map :key (sut/platform-keybindings manifest-keybindings "mac"))))
    (is (= ["ctrl+/" "shift+alt+right" "alt+right" "ctrl+right" "backspace" "ctrl+enter" "ctrl+alt+c ctrl+alt+j" "ctrl+alt+space a"]
           (map :key (sut/platform-keybindings manifest-keybindings "linux"))))))

(deftest setting-keys-test
  (testing "the settings the keybindings' when clauses read, and the settings behind Calva's context keys"
    (is (= #{"calva.keybindingsEnabled" "calva.paredit.defaultKeyMap" "calva.paredit.hijackVSCodeDefaults"}
           (sut/setting-keys mac-keybindings)))))
