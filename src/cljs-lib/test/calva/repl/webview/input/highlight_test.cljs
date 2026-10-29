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
