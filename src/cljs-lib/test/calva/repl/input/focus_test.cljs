(ns calva.repl.input.focus-test
  (:require
   [calva.repl.input.focus :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest focused-after-test
  (testing "focus in a REPL Input makes it the focused one"
    (is (= "output-view" (sut/focused-after nil [:focus "output-view"]))))

  (testing "focus moving to the other view's REPL Input follows it"
    (is (= "output-sidebar" (sut/focused-after "output-view" [:focus "output-sidebar"]))))

  (testing "blur of the focused REPL Input clears the focus"
    (is (nil? (sut/focused-after "output-view" [:blur "output-view"]))))

  (testing "a blur arriving after the other view's REPL Input got focus keeps that focus"
    (is (= "output-sidebar" (sut/focused-after "output-sidebar" [:blur "output-view"]))))

  (testing "the focused REPL Input's view being disposed clears the focus"
    (is (nil? (sut/focused-after "output-view" [:dispose "output-view"]))))

  (testing "the focused REPL Input's view being hidden clears the focus"
    (is (nil? (sut/focused-after "output-sidebar" [:hide "output-sidebar"]))))

  (testing "the other view being disposed or hidden keeps the focus"
    (is (= "output-view" (sut/focused-after "output-view" [:dispose "output-sidebar"])))
    (is (= "output-view" (sut/focused-after "output-view" [:hide "output-sidebar"]))))

  (testing "the focused REPL Input being turned off clears the focus"
    (is (nil? (sut/focused-after "output-view" [:unmount "output-view"]))))

  (testing "a text editor getting focus clears the focus"
    (is (nil? (sut/focused-after "output-view" [:text-editor-focus])))
    (is (nil? (sut/focused-after nil [:text-editor-focus])))))
