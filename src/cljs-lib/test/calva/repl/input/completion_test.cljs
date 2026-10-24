(ns calva.repl.input.completion-test
  (:require
   [calva.repl.input.completion :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest suggests?
  (testing "an explicit request always completes"
    (is (true? (sut/suggests? {"editor.quickSuggestions" false} {} true))))
  (testing "as you type, by `editor.quickSuggestions` for the place of the cursor"
    (let [settings {"editor.quickSuggestions" {"other" "on" "comments" "off" "strings" "inline"}}]
      (is (true? (sut/suggests? settings {} false)))
      (is (false? (sut/suggests? settings {"calva:cursorInComment" true} false)))
      (is (false? (sut/suggests? settings {"calva:cursorInString" true} false)))))
  (testing "`editor.quickSuggestions` as a boolean, and its default"
    (is (false? (sut/suggests? {"editor.quickSuggestions" false} {} false)))
    (is (true? (sut/suggests? {} {} false)))))

(deftest contexts
  (is (= {"calva:replInputCompletionActive" false "calva:replInputCompletionAcceptsEnter" false}
         (sut/contexts false {}))
      "Neither while the list is closed")
  (is (= {"calva:replInputCompletionActive" true "calva:replInputCompletionAcceptsEnter" true}
         (sut/contexts true {"editor.acceptSuggestionOnEnter" "smart"}))
      "`enter` picks a candidate unless `editor.acceptSuggestionOnEnter` is off")
  (is (= {"calva:replInputCompletionActive" true "calva:replInputCompletionAcceptsEnter" false}
         (sut/contexts true {"editor.acceptSuggestionOnEnter" "off"}))
      "`tab` still picks with `editor.acceptSuggestionOnEnter` off"))

(deftest options
  (let [items [{:label "string/upper-case" :kind 3 :detail "clojure.string/upper-case"
                :textEdit {:newText "string/upper-case" :range {}}}
               {:label "defn" :kind 15 :insertText "(defn $1)" :insertTextFormat 2}
               {:label "to-pirate-talk" :kind 3 :data {:provider "repl"}}
               {:label ":as" :kind 14 :insertText ":as "}]]
    (testing "candidates with the index of their item, a CodeMirror type for their kind, and what they insert"
      (is (= [{:label "string/upper-case" :type "function" :detail "clojure.string/upper-case" :index 0}
              {:label "to-pirate-talk" :type "function" :index 2}
              {:label ":as" :type "keyword" :apply ":as " :index 3}]
             (sut/options items {"editor.suggest.showInlineDetails" true}))))
    (testing "no details with `editor.suggest.showInlineDetails` off"
      (is (= [nil nil nil] (map :detail (sut/options items {"editor.suggest.showInlineDetails" false})))))))

(deftest editor-settings
  (is (= {:activate-on-typing? true :delay 10 :accept-on-enter? true :icons? true}
         (sut/editor-settings {}))
      "VS Code's defaults")
  (is (= {:activate-on-typing? false :delay 50 :accept-on-enter? false :icons? false}
         (sut/editor-settings {"editor.quickSuggestions" {"other" "off" "comments" "off" "strings" "off"}
                               "editor.quickSuggestionsDelay" 50
                               "editor.acceptSuggestionOnEnter" "off"
                               "editor.suggest.showIcons" false}))
      "Typing opens the list when quick suggestions are on anywhere"))
