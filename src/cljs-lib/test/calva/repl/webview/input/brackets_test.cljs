(ns calva.repl.webview.input.brackets-test
  (:require
   [calva.repl.webview.input.brackets :as sut]
   [cljs.test :refer-macros [deftest testing is]]
   [clojure.string :as string]))

(deftest mark-ranges-test
  (testing "marks each range with the class that paints it"
    (is (= #{[0 1 "repl-input-bracket-0"]
             [5 6 "repl-input-bracket-1"]
             [7 8 "repl-input-misplaced-bracket"]
             [0 6 "repl-input-comment-form"]
             [2 4 "repl-input-ignored-form"]
             [9 12 "repl-input-ignored-top-level-form"]
             [0 1 "repl-input-matched-bracket"]}
           (set (sut/mark-ranges {:brackets [[0 1 0] [5 6 1]]
                                  :misplaced [[7 8]]
                                  :commentForms [[0 6]]
                                  :ignoredForms [[2 4]]
                                  :topLevelIgnoredForms [[9 12]]
                                  :matched [[0 1]]})))))
  (testing "leaves out empty ranges"
    (is (= [] (sut/mark-ranges {:matched [[3 3]]})))))

(def ^:private styles
  {:bracket-colors [["#000" "#ccc"] "#0098e6"]
   :misplaced {"light" {"color" "#fff" "backgroundColor" "#c33"}
               "dark" {"color" "#ccc" "backgroundColor" "#933"}
               "overviewRulerLane" 4}
   :matched {"light" {"backgroundColor" "#d0d0d0"}
             "dark" {"backgroundColor" "#444"}}
   :comment-form {"fontStyle" "italic"}
   :ignored-form {"textDecoration" "none; opacity: 0.5"}
   :ignored-top-level-form {"textDecoration" "none; opacity: 0.5"}})

(deftest css-test
  (let [css (sut/css styles)
        lines (set (string/split-lines css))]
    (testing "colors a bracket the same in every theme"
      (is (contains? lines ".repl-input-bracket-1 { color: #0098e6; }")))
    (testing "colors a bracket by the theme's kind, for a light and dark pair"
      (is (contains? lines "body.vscode-light .repl-input-bracket-0, body.vscode-high-contrast-light .repl-input-bracket-0 { color: #000; }"))
      (is (contains? lines "body.vscode-dark .repl-input-bracket-0, body.vscode-high-contrast:not(.vscode-high-contrast-light) .repl-input-bracket-0 { color: #ccc; }")))
    (testing "styles the forms and brackets the way their decorations do in files"
      (is (contains? lines "body.vscode-dark .repl-input-misplaced-bracket, body.vscode-high-contrast:not(.vscode-high-contrast-light) .repl-input-misplaced-bracket { color: #ccc; background-color: #933; }"))
      (is (contains? lines "body.vscode-light .repl-input-matched-bracket, body.vscode-high-contrast-light .repl-input-matched-bracket { background-color: #d0d0d0; }"))
      (is (contains? lines ".repl-input-comment-form { font-style: italic; }"))
      (is (contains? lines ".repl-input-ignored-form { text-decoration: none; opacity: 0.5; }"))
      (is (contains? lines ".repl-input-ignored-top-level-form { text-decoration: none; opacity: 0.5; }")))
    (testing "leaves out what CSS can't paint"
      (is (not (string/includes? css "overview"))))))
