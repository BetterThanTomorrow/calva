(ns calva.repl.input.definition-test
  (:require
   [calva.repl.input.definition :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest evaluation-id-test
  (testing "reads the id back from the file name of a REPL Input evaluation"
    (is (= 1792866471588 (sut/evaluation-id (sut/evaluation-file 1792866471588))))
    (is (= 41 (sut/evaluation-id "calva-repl-input/41.clj"))))
  (testing "returns nil for other files"
    (is (nil? (sut/evaluation-id "file:/project/src/pirate/core.clj")))
    (is (nil? (sut/evaluation-id "calva-repl-input/41.cljs")))
    (is (nil? (sut/evaluation-id nil)))))

(def entries
  [{:repl-input.history/id 40 :repl-input.history/code "(def a 1)"}
   {:repl-input.history/id 41 :repl-input.history/code "(do\n  (defn f [x]\n    x))"}])

(deftest entry-location-test
  (testing "falls back to the history entry with the evaluation's id, read-only, at the definition"
    (is (= {:uri "calva-repl-input:/41.clj" :line 1 :character 2}
           (sut/entry-location entries 41 {:line 2 :column 3}))))
  (testing "returns nil when no entry has the id"
    (is (nil? (sut/entry-location entries 42 {:line 1 :column 1})))))

(deftest entry-code-test
  (testing "the read-only editor's text is the code of the entry its path names"
    (is (= "(def a 1)" (sut/entry-code entries "/40.clj"))))
  (testing "returns nil for a path without an entry"
    (is (nil? (sut/entry-code entries "/42.clj")))
    (is (nil? (sut/entry-code entries "/pirate.clj")))))

(deftest repl-target-test
  (testing "a definition the REPL reports in a REPL Input evaluation leads to that evaluation"
    (is (= {:target :evaluation :id 41 :line 2 :column 3}
           (sut/repl-target {:file "calva-repl-input/41.clj" :line 2 :column 3}))))
  (testing "a definition in a file leads to the file"
    (is (= {:target :repl-file :definition {:file "file:/p/core.clj" :line 2 :column 3}}
           (sut/repl-target {:file "file:/p/core.clj" :line 2 :column 3})))))

(def copy {:text-line 3 :document-uri "file:///p/core.clj"})

(deftest lsp-target-test
  (testing "a definition outside the copy leads to its file"
    (is (= {:target :location :uri "file:///p/other.clj" :line 4 :character 6}
           (sut/lsp-target copy {:uri "file:///p/other.clj" :line 4 :character 6 :inCopy false}))))
  (testing "a definition in the followed file's part of the copy leads to the followed file"
    (is (= {:target :location :uri "file:///p/core.clj" :line 2 :character 6}
           (sut/lsp-target copy {:uri "copy" :line 2 :character 6 :inCopy true}))))
  (testing "a definition in the REPL Input's part of the copy, or below an ns form, leads nowhere"
    (is (nil? (sut/lsp-target copy {:uri "copy" :line 3 :character 0 :inCopy true})))
    (is (nil? (sut/lsp-target (assoc copy :document-uri nil) {:uri "copy" :line 0 :character 0 :inCopy true}))))
  (testing "no definition leads nowhere"
    (is (nil? (sut/lsp-target copy nil)))))

(deftest revealing-view-test
  (testing "reveals a visible view that has the block, before one that is hidden"
    (is (= "output-sidebar"
           (sut/revealing-view [{:view-id "output-view" :found? true :visible? false}
                                {:view-id "output-sidebar" :found? true :visible? true}]))))
  (testing "reveals a hidden view that has the block"
    (is (= "output-view"
           (sut/revealing-view [{:view-id "output-view" :found? true :visible? false}
                                {:view-id "output-sidebar" :found? false :visible? true}]))))
  (testing "reveals nothing when no view has the block"
    (is (nil? (sut/revealing-view [{:view-id "output-view" :found? false :visible? true}])))))
