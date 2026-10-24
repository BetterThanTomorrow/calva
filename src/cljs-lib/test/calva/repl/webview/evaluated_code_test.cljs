(ns calva.repl.webview.evaluated-code-test
  (:require
   [calva.repl.webview.evaluated-code :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def code "(do\n  (defn f [x]\n    x))")

(def block {:repl-input.evaluation/line 2 :repl-input.evaluation/column 4})

(deftest definition-range-test
  (testing "marks from the definition to the end of its line"
    (is (= [6 17] (sut/definition-range code block {:line 4 :column 3})))
    (is (= [0 3] (sut/definition-range code block {:line 3 :column 5}))))
  (testing "marks nothing for a definition outside the code"
    (is (nil? (sut/definition-range code block {:line 2 :column 1})))
    (is (nil? (sut/definition-range code block {:line 9 :column 1})))))
