(ns calva.interpolate-test
  (:require [cljs.test :refer [deftest testing is]]
            [calva.interpolate :as sut]))

(deftest interpolate-basic-variables-test
  (testing "all non-clojure variables interpolation"
    (is (= (sut/interpolate-variables "text"
                                      (str "Line: $line\n"
                                           "Column: $column\n"
                                           "File: $file\n"
                                           "File Text: $file-text\n"
                                           "NS: $ns\n"
                                           "Editor NS: $editor-ns\n"
                                           "REPL: $repl\n"
                                           "Selection: $selection\n"
                                           "Selection+Brackets: $selection-closing-brackets\n"
                                           "Hover Line: $hover-line\n"
                                           "Hover Column: $hover-column\n"
                                           "Hover File: $hover-file\n"
                                           "Hover File Text: $hover-file-text\n"
                                           "Hover Text: $hover-text\n")
                                      #js {:currentLine 42
                                           :currentColumn 10
                                           :currentFilename "/path/to/file.clj"
                                           :currentFileText #js [nil "file contents"]
                                           :selection "selected text"
                                           :selectionWithBracketTrail #js [nil "selected text)"]
                                           :ns "user"
                                           :editorNs "editor.ns"
                                           :repl "clj"
                                           :hoverLine 43
                                           :hoverColumn 11
                                           :hoverFilename "/path/to/hover.clj"
                                           :hoverCurrentFileText #js [nil "hover file contents"]
                                           :hoverText "hovered text"})
           (str "Line: 42\n"
                "Column: 10\n"
                "File: /path/to/file.clj\n"
                "File Text: file contents\n"
                "NS: user\n"
                "Editor NS: editor.ns\n"
                "REPL: clj\n"
                "Selection: selected text\n"
                "Selection+Brackets: selected text)\n"
                "Hover Line: 43\n"
                "Hover Column: 11\n"
                "Hover File: /path/to/hover.clj\n"
                "Hover File Text: hover file contents\n"
                "Hover Text: hovered text\n"))
        "interpolates all non-clojure variables"))

  (testing "all clojure-specific variables"
    (is (= (sut/interpolate-variables "clojure"
                                      (str "Current Form: $current-form\n"
                                           "Current Pair: $current-pair\n"
                                           "Enclosing Form: $enclosing-form\n"
                                           "Top Level Form: $top-level-form\n"
                                           "Current Fn: $current-fn\n"
                                           "Top Level Fn: $top-level-fn\n"
                                           "Top Level Defined Symbol: $top-level-defined-symbol\n"
                                           "Head: $head\n"
                                           "Tail: $tail\n"
                                           "Hover Current Form: $hover-current-form\n"
                                           "Hover Current Pair: $hover-current-pair\n"
                                           "Hover Enclosing Form: $hover-enclosing-form\n"
                                           "Hover Top Level Form: $hover-top-level-form\n"
                                           "Hover Current Fn: $hover-current-fn\n"
                                           "Hover Top Level Fn: $hover-top-level-fn\n"
                                           "Hover Top Level Defined Symbol: $hover-top-level-defined-symbol\n"
                                           "Hover Head: $hover-head\n"
                                           "Hover Tail: $hover-tail\n")
                                      #js {:currentForm #js [nil "(+ 1 2)"]
                                           :currentPair #js [nil "a b"]
                                           :enclosingForm #js [nil "(let [x 1] (+ x 2))"]
                                           :topLevelForm #js [nil "(defn foo [x] (+ x 1))"]
                                           :currentFn #js [nil "+"]
                                           :topLevelFn #js [nil "defn"]
                                           :topLevelDefinedForm #js [nil "foo"]
                                           :head #js [nil "(+ 1"]
                                           :tail #js [nil "2)"]
                                           :hoverCurrentForm #js [nil "(- 3 4)"]
                                           :hoverCurrentPair #js [nil "[c d]"]
                                           :hoverEnclosingForm #js [nil "(let [y 2] (- y 3))"]
                                           :hoverTopLevelForm #js [nil "(defn bar [y] (- y 2))"]
                                           :hoverCurrentFn #js [nil "-"]
                                           :hoverTopLevelFn #js [nil "defn"]
                                           :hoverTopLevelDefinedForm #js [nil "bar"]
                                           :hoverHead #js [nil "(- 3"]
                                           :hoverTail #js [nil "4)"]})
           (str "Current Form: (+ 1 2)\n"
                "Current Pair: a b\n"
                "Enclosing Form: (let [x 1] (+ x 2))\n"
                "Top Level Form: (defn foo [x] (+ x 1))\n"
                "Current Fn: +\n"
                "Top Level Fn: defn\n"
                "Top Level Defined Symbol: foo\n"
                "Head: (+ 1\n"
                "Tail: 2)\n"
                "Hover Current Form: (- 3 4)\n"
                "Hover Current Pair: [c d]\n"
                "Hover Enclosing Form: (let [y 2] (- y 3))\n"
                "Hover Top Level Form: (defn bar [y] (- y 2))\n"
                "Hover Current Fn: -\n"
                "Hover Top Level Fn: defn\n"
                "Hover Top Level Defined Symbol: bar\n"
                "Hover Head: (- 3\n"
                "Hover Tail: 4)\n"))
        "interpolates all clojure-specific variables"))

  (testing "missing variables"
    (let [text (str "Line: $line\n"
                    "Column: $column\n"
                    "File: $file\n"
                    "File Text: $file-text\n"
                    "NS: $ns\n"
                    "Editor NS: $editor-ns\n"
                    "REPL: $repl\n"
                    "Selection: $selection\n"
                    "Selection+Brackets: $selection-closing-brackets\n"
                    "Hover Line: $hover-line\n"
                    "Hover Column: $hover-column\n"
                    "Hover File: $hover-file\n"
                    "Hover File Text: $hover-file-text\n"
                    "Hover Text: $hover-text\n"
                    "Current Form: $current-form\n"
                    "Current Pair: $current-pair\n"
                    "Enclosing Form: $enclosing-form\n"
                    "Top Level Form: $top-level-form\n"
                    "Current Fn: $current-fn\n"
                    "Top Level Fn: $top-level-fn\n"
                    "Top Level Defined Symbol: $top-level-defined-symbol\n"
                    "Head: $head\n"
                    "Tail: $tail\n"
                    "Hover Current Form: $hover-current-form\n"
                    "Hover Current Pair: $hover-current-pair\n"
                    "Hover Enclosing Form: $hover-enclosing-form\n"
                    "Hover Top Level Form: $hover-top-level-form\n"
                    "Hover Current Fn: $hover-current-fn\n"
                    "Hover Top Level Fn: $hover-top-level-fn\n"
                    "Hover Top Level Defined Symbol: $hover-top-level-defined-symbol\n"
                    "Hover Head: $hover-head\n"
                    "Hover Tail: $hover-tail\n")
          expected (str "Line: \n"
                        "Column: \n"
                        "File: \n"
                        "File Text: \n"
                        "NS: \n"
                        "Editor NS: \n"
                        "REPL: \n"
                        "Selection: \n"
                        "Selection+Brackets: \n"
                        "Hover Line: \n"
                        "Hover Column: \n"
                        "Hover File: \n"
                        "Hover File Text: \n"
                        "Hover Text: \n"
                        "Current Form: \n"
                        "Current Pair: \n"
                        "Enclosing Form: \n"
                        "Top Level Form: \n"
                        "Current Fn: \n"
                        "Top Level Fn: \n"
                        "Top Level Defined Symbol: \n"
                        "Head: \n"
                        "Tail: \n"
                        "Hover Current Form: \n"
                        "Hover Current Pair: \n"
                        "Hover Enclosing Form: \n"
                        "Hover Top Level Form: \n"
                        "Hover Current Fn: \n"
                        "Hover Top Level Fn: \n"
                        "Hover Top Level Defined Symbol: \n"
                        "Hover Head: \n"
                        "Hover Tail: \n")]
      (is (= (sut/interpolate-variables "clojure"
                                        text
                                        #js {})
             expected)
          "handles missing variables by replacing them with empty strings")
      (is (= (sut/interpolate-variables "clojure"
                                        text
                                        #js {:currentLine js/undefined
                                             :currentFileText #js [nil js/undefined]
                                             :selectionWithBracketTrail js/undefined})
             expected)
          "handles undefined variables by replacing them with empty strings")))

  (testing "backslash escaping in filenames"
    (is (= (sut/interpolate-variables "text"
                                      "File: $file"
                                      #js {:currentFilename "C:\\path\\to\\file.clj"})
           "File: C:\\\\path\\\\to\\\\file.clj"))))