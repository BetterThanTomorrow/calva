(ns calva.repl.webview.keybindings-note-test
  (:require
   [calva.repl.webview.keybindings-note :as sut]
   [cljs.test :refer-macros [deftest is]]))

(def missing
  [{:key "shift+alt+right" :command "paredit.selectForwardSexp"
    :when "editorTextFocus && editorLangId == 'clojure'"
    :calva-when "calva:keybindingsEnabled && (editorLangId == clojure && editorTextFocus || calva:replInputFocused || calva:printedCodeFocused)"}])

(deftest element-test
  (is (nil? (sut/element []))
      "No note when every keybinding reaches the Output views")
  (let [[tag attrs [_ summary] _ [_ items] [_ button-attrs]] (sut/element missing)]
    (is (= [:details ["keybindings-note"]] [tag (:class attrs)])
        "A folded note")
    (is (= "1 of your keybindings doesn't reach the Output views" summary)
        "The folded line says how many")
    (is (= [[:li [:code "shift+alt+right"] " " [:code "paredit.selectForwardSexp"]
             [:dl
              [:dt "Your " [:code "when"]] [:dd [:code "editorTextFocus && editorLangId == 'clojure'"]]
              [:dt "Calva's " [:code "when"]] [:dd [:code (:calva-when (first missing))]]]]]
           items)
        "Each keybinding with its when clause and Calva's")
    (is (= "[[:keybindings-note/ax.read-again]]" (:data-action button-attrs))
        "The button reads the keybindings again"))
  (is (= "2 of your keybindings don't reach the Output views"
         (second (second (rest (sut/element (into missing missing))))))
      "The folded line counts several"))
