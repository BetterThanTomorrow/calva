(ns calva.repl.input.when-clause-test
  (:require
   [calva.repl.input.when-clause :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(defn- holds? [clause context]
  (sut/holds? (sut/parse clause) context))

(deftest holds?-test
  (testing "a missing clause holds"
    (is (holds? nil {}))
    (is (holds? "" {})))
  (testing "a key holds when its value is truthy"
    (is (holds? "calva:replInputFocused" {"calva:replInputFocused" true}))
    (is (not (holds? "calva:replInputFocused" {})))
    (is (not (holds? "calva:replInputFocused" {"calva:replInputFocused" false}))))
  (testing "`!`, `&&` and `||` bind as in VS Code, `&&` before `||`"
    (is (holds? "a && !b || c" {"c" true}))
    (is (holds? "a && !b || c" {"a" true}))
    (is (not (holds? "a && !b || c" {"a" true "b" true})))
    (is (not (holds? "a && (b || c)" {"c" true}))))
  (testing "equality compares with the value, quoted or not"
    (is (holds? "paredit:keyMap == strict" {"paredit:keyMap" "strict"}))
    (is (holds? "editorLangId == 'clojure'" {"editorLangId" "clojure"}))
    (is (holds? "paredit:keyMap != 'strict'" {"paredit:keyMap" "original"}))
    (is (not (holds? "paredit:keyMap =~ /original|strict/" {"paredit:keyMap" "none"})))
    (is (holds? "paredit:keyMap =~ /Original|strict/i" {"paredit:keyMap" "original"})))
  (testing "literals"
    (is (holds? "true" {}))
    (is (not (holds? "false || a" {})))))

(deftest context-keys-test
  (testing "the keys a clause reads"
    (is (= #{"calva:keybindingsEnabled" "config.calva.paredit.hijackVSCodeDefaults" "paredit:keyMap"}
           (sut/context-keys (sut/parse "calva:keybindingsEnabled && (config.calva.paredit.hijackVSCodeDefaults || paredit:keyMap =~ /strict/)"))))))
