(ns calva.docs.highlight-test
  (:require [calva.docs.highlight :as highlight]
            [clojure.test :refer [deftest is testing]]))

(deftest tokens
  (testing "Clojure forms, names and literals get Material's code classes"
    (is (= [["p" "("] ["kd" "defn"] [nil " "] ["nv" "f"] [nil " "] ["p" "["] ["nv" "x"] ["p" "]"]
            [nil " "] ["p" "("] ["k" "if"] [nil " "] ["p" "("] ["nb" "pos?"] [nil " "] ["nv" "x"] ["p" ")"]
            [nil " "] ["p" "("] ["nf" "my/inc"] [nil " "] ["nv" "x"] ["p" ")"] [nil " "] ["p" "{"]
            ["ss" ":a"] [nil " "] ["s" "\"s \\\" ;\""] [nil ", "] ["ss" "::b"] [nil " "] ["m" "-1.5"]
            [nil " "] ["sc" "\\c"] ["p" "}"] ["p" ")"] ["p" ")"] [nil " "] ["c1" "; done"] [nil "\n"]
            ["o" "#"] ["p" "("] ["nb" "inc"] [nil " "] ["nv" "%"] ["p" ")"] [nil " "] ["o" "@"] ["nv" "a"]]
           (highlight/tokens "clojure" (str "(defn f [x] (if (pos? x) (my/inc x) {:a \"s \\\" ;\", ::b -1.5 \\c})) ; done\n"
                                            "#(inc %) @a")))))
  (testing "JSON keys are told from string values"
    (is (= [["p" "{"] ["nt" "\"a\""] ["p" ":"] [nil " "] ["p" "["] ["m" "1"] ["p" ","] [nil " "] ["kc" "true"]
            ["p" ","] [nil " "] ["s2" "\"b\""] ["p" "]"] ["p" "}"] [nil " "] ["c1" "// c"]]
           (highlight/tokens "jsonc" "{\"a\": [1, true, \"b\"]} // c"))))
  (testing "TypeScript names after a parameter's colon are types"
    (is (= [[nil "f"] ["p" "("] [nil "e"] ["o" ":"] [nil " "] ["kt" "vscode.Uri"] ["p" ")"] ["o" ":"] [nil " "]
            ["ow" "void"]]
           (highlight/tokens "ts" "f(e: vscode.Uri): void"))))
  (testing "Code in a language without rules is one plain token"
    (is (= [[nil "FROM clojure\n"]] (highlight/tokens "Dockerfile" "FROM clojure\n")))
    (is (= [] (highlight/tokens nil "")))))

(deftest code-block
  (is (= [:div.highlight [:pre [:code (list [:span {:class "ss"} ":a"] " ")]]]
         (highlight/code-block "edn" ":a "))))
