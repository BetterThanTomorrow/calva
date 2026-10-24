(ns calva.repl.input.completion-test
  (:require
   [calva.repl.input.completion :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def following
  {:repl-input.context/ns "pirate.core"
   :repl-input.context/ns-form "(ns pirate.core)"
   :repl-input.context/locked? false})

(def locked
  {:repl-input.context/ns "pirate.ui"
   :repl-input.context/ns-form "(in-ns 'pirate.ui)"
   :repl-input.context/locked? true})

(deftest copy-text
  (testing "the followed file's text, then the REPL Input's text"
    (is (= "(ns pirate.core\n  (:require [clojure.string :as string]))\n\n(defn to-pirate-talk [s] s)\n\n(string/upp)"
           (:text (sut/copy following
                            "(ns pirate.core\n  (:require [clojure.string :as string]))\n\n(defn to-pirate-talk [s] s)\n"
                            "(string/upp)"
                            11)))))
  (testing "the locked `ns` form, then the REPL Input's text, also while an editor is followed"
    (is (= "(in-ns 'pirate.ui)\n(render)"
           (:text (sut/copy locked "(ns pirate.core)" "(render)" 7)))))
  (testing "the context's `ns` form when no file has been followed"
    (is (= "(ns pirate.core)\n(to-pir)"
           (:text (sut/copy following nil "(to-pir)" 7))))))

(deftest copy-cursor-position
  (testing "the cursor on the REPL Input's first line, below a file"
    (is (= {:line 4 :character 11}
           (select-keys (sut/copy following "(ns pirate.core)\n\n(def x 1)\n" "(string/upp)" 11)
                        [:line :character]))))
  (testing "the cursor on a later line of the REPL Input, below the locked `ns` form"
    (is (= {:line 2 :character 8}
           (select-keys (sut/copy locked nil "(foo\n  (bar ba))" 13)
                        [:line :character]))))
  (testing "an empty REPL Input"
    (is (= {:line 1 :character 0}
           (select-keys (sut/copy following nil "" 0) [:line :character])))))

(deftest copy-text-line
  (testing "the REPL Input's text starts on the line after the followed file"
    (is (= 4 (:text-line (sut/copy following "(ns pirate.core)\n\n(def x 1)\n" "(string/upp)" 11)))))
  (testing "the REPL Input's text starts on the line after the ns form"
    (is (= 1 (:text-line (sut/copy locked nil "(foo)" 0))))))

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

(deftest arglists-and-docstring
  (is (= "```clojure\n(map [f] [f coll])\n```\n\nReturns a lazy sequence."
         (sut/arglists-and-docstring "```clojure\n(map [f] [f coll])\n```\n\nReturns a lazy sequence.\n\n__Examples:__\n\n```clojure\n(map inc [1 2])\n```\n\n__See also:__\n\n[clojure.core/mapv](https://clojuredocs.org/clojure.core/mapv)\n\n----\n\n*[core.clj](jar:file:///core.clj)*"))
      "Leaves out clojuredocs' examples and links, and where the var is defined")
  (is (= "Returns a lazy sequence."
         (sut/arglists-and-docstring "Returns a lazy sequence.\n\n__Notes:__\n\nA note"))
      "Leaves out clojuredocs' notes when there are no examples")
  (is (= "```clojure\n(to-pirate-talk [text language])\n```"
         (sut/arglists-and-docstring "```clojure\n(to-pirate-talk [text language])\n```\n\n----\n\n*[pirate_lang.clj](file:///pirate_lang.clj)*"))
      "Leaves out where a var without a docstring is defined")
  (is (= "Converts string to all upper-case."
         (sut/arglists-and-docstring "Converts string to all upper-case."))
      "Keeps docs that have nothing to leave out")
  (is (nil? (sut/arglists-and-docstring nil))))
