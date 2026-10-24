(ns calva.repl.input.brackets-test
  (:require
   [calva.repl.input.brackets :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest close-brackets-test
  (testing "closes brackets and quotes unless the editor settings for Clojure say never"
    (is (= ["(" "[" "{" "\""]
           (sut/close-brackets {"editor.autoClosingBrackets" "languageDefined"
                                "editor.autoClosingQuotes" "always"})))
    (is (= ["\""]
           (sut/close-brackets {"editor.autoClosingBrackets" "never"
                                "editor.autoClosingQuotes" "beforeWhitespace"})))
    (is (= ["(" "[" "{"]
           (sut/close-brackets {"editor.autoClosingBrackets" "always"
                                "editor.autoClosingQuotes" "never"})))))

(deftest rainbow-options-test
  (testing "counts the bracket colors, and follows cycleBracketColors"
    (is (= {:colorCount 3 :cycleBracketColors false}
           (sut/rainbow-options {"calva.highlight.bracketColors" [["#000" "#ccc"] "#0098e6" "#e16d6d"]
                                 "calva.highlight.cycleBracketColors" false}))))
  (testing "has at least one color index"
    (is (= 1 (:colorCount (sut/rainbow-options {"calva.highlight.bracketColors" []}))))))

(def ^:private highlight-defaults
  {"calva.highlight.enableBracketColors" true
   "calva.highlight.bracketColors" [["#000" "#ccc"] "#0098e6"]
   "calva.highlight.misplacedBracketStyle" nil
   "calva.highlight.matchedBracketStyle" nil
   "calva.highlight.commentFormStyle" nil
   "calva.highlight.ignoredFormStyle" nil
   "calva.highlight.ignoredTopLevelFormStyle" nil})

(deftest bracket-styles-test
  (testing "falls back on the styles Calva paints files with"
    (is (= {:bracket-colors [["#000" "#ccc"] "#0098e6"]
            :misplaced {"light" {"color" "#fff" "backgroundColor" "#c33"}
                        "dark" {"color" "#ccc" "backgroundColor" "#933"}}
            :matched {"light" {"backgroundColor" "#d0d0d0"}
                      "dark" {"backgroundColor" "#444"}}
            :comment-form {"fontStyle" "italic"}
            :ignored-form {"textDecoration" "none; opacity: 0.5"}
            :ignored-top-level-form {"textDecoration" "none; opacity: 0.5"}}
           (sut/bracket-styles highlight-defaults))))
  (testing "takes the styles from the settings, top level ignored forms from ignored forms when not set"
    (is (= {"opacity" "0.3"}
           (:ignored-top-level-form (sut/bracket-styles (assoc highlight-defaults "calva.highlight.ignoredFormStyle" {"opacity" "0.3"})))))
    (is (= {"color" "red"}
           (:matched (sut/bracket-styles (assoc highlight-defaults "calva.highlight.matchedBracketStyle" {"color" "red"}))))))
  (testing "has no bracket colors when they are off"
    (is (= [] (:bracket-colors (sut/bracket-styles (assoc highlight-defaults "calva.highlight.enableBracketColors" false)))))))
