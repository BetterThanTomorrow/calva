(ns calva.docs.blocks-test
  (:require [calva.docs.blocks :as blocks]
            [clojure.string :as string]
            [clojure.test :refer [deftest is testing]]))

(defn- lines [& ls]
  (string/join "\n" ls))

(deftest page-blocks
  (testing "an admonition body is dedented and keeps its fenced code"
    (is (= [{:block/type :markdown :block/markdown "Intro\n"}
            {:block/type :admonition
             :block/qualifier "note"
             :block/title "Look"
             :block/markdown "Text\n\n```clojure\n(+ 1 2)\n```"}
            {:block/type :markdown :block/markdown "\nAfter"}]
           (blocks/page-blocks (lines "Intro" "" "!!! Note \"Look\"" "    Text" ""
                                      "    ```clojure" "    (+ 1 2)" "    ```" "" "After")))))
  (testing "a block without a title gets its qualifier as the title"
    (is (= "Note" (:block/title (first (blocks/page-blocks (lines "!!! note" "    Text")))))))
  (testing "details are closed, unless they start with ???+"
    (is (= [false true]
           (map :block/open?
                (blocks/page-blocks (lines "??? Note \"Closed\"" "    a" "" "???+ Note \"Open\"" "    b"))))))
  (testing "consecutive tabs form one tab set"
    (is (= [{:block/type :tabs
             :block/tabs [{:block/title "A" :block/markdown "a"}
                          {:block/title "B" :block/markdown "b"}]}]
           (blocks/page-blocks (lines "=== \"A\"" "    a" "" "=== \"B\"" "    b")))))
  (testing "block markers inside a fenced code block are code"
    (is (= [{:block/type :markdown :block/markdown "```\n!!! Note\n    x\n```"}]
           (blocks/page-blocks (lines "```" "!!! Note" "    x" "```"))))))
