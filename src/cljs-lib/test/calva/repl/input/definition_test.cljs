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

(def evaluations
  [(sut/evaluation 40 "(def a 1)" 0 0)
   (sut/evaluation 41 "\n(do\n  (defn f [x]\n    x))" 0 0)
   (sut/evaluation 42 "(def b 2)" 2 6)])

(deftest entry-location-test
  (testing "leads to the evaluation's read-only entry, at the definition in the code as it was evaluated"
    (is (= {:uri "calva-repl-input:/41.clj" :line 2 :character 2}
           (sut/entry-location evaluations 41 {:line 3 :column 3}))))
  (testing "counts from where the evaluated code started in the REPL Input"
    (is (= {:uri "calva-repl-input:/42.clj" :line 0 :character 0}
           (sut/entry-location evaluations 42 {:line 3 :column 7}))))
  (testing "returns nil when the code of the evaluation isn't kept"
    (is (nil? (sut/entry-location evaluations 43 {:line 1 :column 1})))))

(deftest entry-code-test
  (testing "the read-only editor's text is the code of the evaluation its path names, as it was evaluated"
    (is (= "\n(do\n  (defn f [x]\n    x))" (sut/entry-code evaluations "/41.clj"))))
  (testing "returns nil for a path without kept code"
    (is (nil? (sut/entry-code evaluations "/43.clj")))
    (is (nil? (sut/entry-code evaluations "/pirate.clj")))))

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

(deftest add-evaluation-test
  (testing "keeps the code of the latest evaluations, newest last"
    (let [added (reduce sut/add-evaluation [] (map #(sut/evaluation % (str "(def a " % ")") 0 0) (range (+ 2 sut/kept-count))))]
      (is (= sut/kept-count (count added)))
      (is (= [2 (inc sut/kept-count)] (map :repl-input.evaluation/id [(first added) (peek added)]))))))

(deftest stored-evaluations-test
  (testing "reads back the evaluations the way workspaceState keeps them"
    (is (= evaluations (sut/from-stored (sut/stored evaluations)))))
  (testing "skips what isn't an evaluation"
    (is (= [] (sut/from-stored [{:id 1} "(def a 1)"]))))
  (testing "reads no evaluations from what workspaceState keeps that isn't a list of evaluations"
    (doseq [stored [5 true "(def a 1)" nil {} (first (sut/stored evaluations))]]
      (is (= [] (sut/from-stored stored)) (pr-str stored)))))
