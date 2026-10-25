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
   (sut/command-keys mac-keybindings (sut/context {:repl-input/settings settings} record) [])))

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
                             (sut/context {:repl-input/settings settings :repl-input/connected? true} record)
                             []))))
  (testing "the user's own keys are always left to VS Code"
    (is (= {:keys #{"ctrl+j" "ctrl+k"} :chords #{"ctrl+k"}}
           (sut/command-keys [] (sut/context {:repl-input/settings settings} record) ["ctrl+j" "ctrl+k ctrl+l"])))))

(deftest command-key-test
  (testing "the key of the first of the command's keybindings that holds while the REPL Input has focus"
    (is (= "alt+right"
           (sut/command-key mac-keybindings (sut/context {:repl-input/settings settings} record) "paredit.forwardSexp")))
    (is (= "ctrl+right"
           (sut/command-key mac-keybindings
                            (sut/context {:repl-input/settings (assoc settings "calva.paredit.hijackVSCodeDefaults" false)} record)
                            "paredit.forwardSexp"))))
  (testing "no key when none of the command's keybindings hold"
    (is (nil? (sut/command-key mac-keybindings
                               (sut/context {:repl-input/settings (assoc settings "calva.keybindingsEnabled" false)} record)
                               "calva.jackIn")))
    (is (nil? (sut/command-key mac-keybindings (sut/context {:repl-input/settings settings} record) "calva.connect")))))

(deftest calva-keybindings-test
  (testing "VS Code's resolved keybindings for the manifest's commands, with the keys resolved for the keyboard layout"
    (is (= [(first resolved-keybindings)]
           (sut/calva-keybindings manifest-keybindings resolved-keybindings))))
  (testing "resolved when clauses evaluate as the manifest's do"
    (is (= #{"shift+cmd+7"}
           (:keys (sut/command-keys (sut/parsed (sut/calva-keybindings manifest-keybindings resolved-keybindings))
                                    (sut/context {:repl-input/settings settings} record)
                                    []))))))

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
