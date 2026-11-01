(ns calva.repl.webview.code-tokens-test
  (:require
   [calva.repl.webview.code-tokens :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest copy-test
  (testing "puts each code on lines of its own below the prefix, and gives the line each starts on"
    (is (= {:text "(ns a)\n(foo)\n(bar\n  x)\n(baz)"
            :lines {"1" 1 "2" 2 "3" 4}}
           (sut/copy "(ns a)" [["1" "(foo)"] ["2" "(bar\n  x)"] ["3" "(baz)"]])))))

(def ^:private palette
  {:palette/token-rules [["entity.name.function" "#purple"]]
   :palette/font-style-rules []
   :palette/semantic-rules []})

(deftest code-ranges-test
  (testing "gives each code the ranges of the tokens on its own lines"
    (is (= [["1" [[1 4 "#purple" nil]]]
            ["2" [[1 4 "#purple" nil]]]]
           (sut/code-ranges palette
                            [[1 1 3 "function" []] [2 1 3 "function" []]]
                            {"1" 1 "2" 2}
                            [["1" "(foo)"] ["2" "(bar)"]])))))
