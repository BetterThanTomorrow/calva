(ns calva.repl.webview.keybindings-note-test
  (:require
   [calva.repl.webview.keybindings-note :as sut]
   [cljs.test :refer-macros [deftest is]]))

(def calva-when
  "calva:keybindingsEnabled && (editorLangId == clojure && editorTextFocus || calva:replInputFocused || calva:printedCodeFocused)")

(def missing
  {:key "shift+alt+right" :command "paredit.selectForwardSexp"
   :when "editorTextFocus && editorLangId == 'clojure'"
   :calva-when calva-when
   :reaches-output-views? false})

(def reaching
  {:key "ctrl+alt+right" :command "paredit.selectForwardSexp"
   :when "calva:printedCodeFocused"
   :calva-when calva-when
   :reaches-output-views? true})

(def read-again-action
  "[[:keybindings-note/ax.read-again]]")

(deftest no-custom-keybindings
  (is (nil? (sut/element []))
      "No note without custom keybindings"))

(deftest every-custom-keybinding-reaches
  (let [[tag attrs [_ summary] missing-list [_ button-attrs]] (sut/element [reaching])]
    (is (= [:details ["keybindings-note"]] [tag (:class attrs)])
        "A folded note")
    (is (= "All custom keybindings reach the Output views" summary)
        "The folded line says they all reach")
    (is (nil? missing-list)
        "Nothing to list")
    (is (= read-again-action (:data-action button-attrs))
        "The button reads the keybindings again")))

(deftest some-custom-keybindings-miss
  (let [[_ _ [_ summary] [_ [_ items]] [_ button-attrs]] (sut/element [reaching missing])
        [[_ [_ [_ key] _ [_ command]] [_ copy-attrs]]] items]
    (is (= "1 of your custom keybindings doesn't reach the Output views" summary)
        "The folded line says how many miss")
    (is (= 1 (count items))
        "Only the keybindings that miss are listed")
    (is (= ["shift+alt+right" "paredit.selectForwardSexp"] [key command])
        "Each with its key and command")
    (is (= [[:keybindings-note/ax.copy-when {:copy/button :event/target :copy/text calva-when}]]
           (:copy/actions copy-attrs))
        "Each with a button that copies the when clause of Calva's keybinding")
    (is (= read-again-action (:data-action button-attrs))
        "The button reads the keybindings again"))
  (is (= "2 of your custom keybindings don't reach the Output views"
         (get-in (sut/element [missing missing]) [2 1]))
      "The folded line counts several"))
