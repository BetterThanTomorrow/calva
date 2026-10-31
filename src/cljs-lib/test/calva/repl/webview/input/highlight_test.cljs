(ns calva.repl.webview.input.highlight-test
  (:require
   [calva.repl.webview.input.highlight :as sut]
   [cljs.test :refer-macros [deftest testing is]]
   ["highlight.js/lib/core" :as hljs]
   ["highlight.js/lib/languages/clojure" :as clojure]))

(.registerLanguage hljs "clojure" clojure)

(deftest scope-class-test
  (testing "gives a plain scope the hljs prefix"
    (is (= "hljs-keyword" (sut/scope-class "keyword"))))
  (testing "gives sub-scopes the trailing underscores highlight.js uses"
    (is (= "hljs-title function_" (sut/scope-class "title.function")))
    (is (= "hljs-title class_ inherited__" (sut/scope-class "title.class.inherited")))))

(deftest highlight-ranges-test
  (let [text "(defn foo [x] \"s\" :k)"
        ranges (sut/highlight-ranges text)
        by-text (into {} (map (fn [[from to class-name]] [(subs text from to) class-name]) ranges))]
    (testing "finds the ranges highlight.js scopes, with their classes"
      (is (= "hljs-keyword" (get by-text "defn")))
      (is (= "hljs-title" (get by-text "foo")))
      (is (= "hljs-string" (get by-text "\"s\"")))
      (is (= "hljs-symbol" (get by-text ":k"))))
    (testing "keeps every range inside the text"
      (is (every? (fn [[from to]] (<= 0 from to (count text))) ranges))))
  (testing "finds nothing in empty text"
    (is (= [] (sut/highlight-ranges "")))))

(deftest typed-quote-test
  (let [text "(str \"ab \\\" cd\" x)"]
    (testing "steps over the quote that closes the string"
      (is (= :step-over (sut/typed-quote text 14))))
    (testing "inserts the quote alone elsewhere in a string"
      (is (= :insert (sut/typed-quote text 6)))
      (is (= :insert (sut/typed-quote text 9))))
    (testing "leaves quotes outside strings to bracket closing"
      (is (nil? (sut/typed-quote text 15)))
      (is (nil? (sut/typed-quote text 1))))))

(deftest layered-test
  (testing "puts the semantic ranges over the grammar ranges, as runs of one color"
    (is (= [[0 2 "#a"] [2 4 "#b"] [4 6 "#a"]]
           (sut/layered [[0 6 "#a"]] [[2 4 "#b"]]))))
  (testing "leaves out what has no color, and joins neighbors of one color"
    (is (= [[1 3 "#a"] [5 6 "#b"]]
           (sut/layered [[1 2 "#a"] [2 3 "#a"]] [[5 6 "#b"]]))))
  (testing "returns no runs without ranges"
    (is (= [] (sut/layered nil nil)))))

(deftest mapped-test
  (let [insert-at-2 (fn [pos _assoc] (if (>= pos 2) (+ pos 3) pos))]
    (testing "moves the ranges after an insertion"
      (is (= [[0 1 "#a"] [5 7 "#b"]] (sut/mapped [[0 1 "#a"] [2 4 "#b"]] insert-at-2)))))
  (testing "drops the ranges a deletion empties"
    (is (= [[0 1 "#a"]] (sut/mapped [[0 1 "#a"] [2 4 "#b"]] (fn [pos _assoc] (min pos 2)))))))

(deftest color-class-test
  (testing "gives a hex color a class"
    (is (= "repl-input-color-ff7b72" (sut/color-class "#FF7B72")))
    (is (= "repl-input-color-ff7b72cc" (sut/color-class "#ff7b72cc"))))
  (testing "gives no class for anything but a hex color"
    (is (nil? (sut/color-class "red")))
    (is (nil? (sut/color-class "#fff; } body { color: red")))
    (is (nil? (sut/color-class nil)))))
