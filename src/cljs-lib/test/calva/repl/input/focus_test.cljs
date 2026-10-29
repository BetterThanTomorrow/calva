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

  (testing "the focused REPL Input's view going inactive clears the focus"
    (is (nil? (sut/focused-after "output-view" [:deactivate "output-view"]))))

  (testing "the other view being disposed or hidden keeps the focus"
    (is (= "output-view" (sut/focused-after "output-view" [:dispose "output-sidebar"])))
    (is (= "output-view" (sut/focused-after "output-view" [:hide "output-sidebar"]))))

  (testing "the focused REPL Input being turned off clears the focus"
    (is (nil? (sut/focused-after "output-view" [:unmount "output-view"]))))

  (testing "a text editor or a terminal getting focus clears the focus"
    (is (nil? (sut/focused-after "output-view" [:text-editor-focus])))
    (is (nil? (sut/focused-after nil [:text-editor-focus])))
    (is (nil? (sut/focused-after "output-view" [:terminal-focus])))))

(deftest last-focused-after-test
  (testing "focus in a REPL Input makes it the last focused place"
    (is (= "output-view" (sut/last-focused-after nil [:focus "output-view"])))
    (is (= "output-sidebar" (sut/last-focused-after "output-view" [:focus "output-sidebar"]))))

  (testing "stays the last focused place when it loses the focus, as to the command palette"
    (is (= "output-view" (sut/last-focused-after "output-view" [:blur "output-view"]))))

  (testing "a text editor or a terminal getting focus ends it"
    (is (nil? (sut/last-focused-after "output-view" [:text-editor-focus])))
    (is (nil? (sut/last-focused-after "output-view" [:terminal-focus]))))

  (testing "its view being hidden, disposed or going inactive, or the REPL Input being turned off, ends it"
    (is (nil? (sut/last-focused-after "output-sidebar" [:hide "output-sidebar"])))
    (is (nil? (sut/last-focused-after "output-view" [:dispose "output-view"])))
    (is (nil? (sut/last-focused-after "output-view" [:deactivate "output-view"])))
    (is (nil? (sut/last-focused-after "output-view" [:unmount "output-view"]))))

  (testing "the other view being hidden or going inactive keeps it"
    (is (= "output-view" (sut/last-focused-after "output-view" [:hide "output-sidebar"])))
    (is (= "output-sidebar" (sut/last-focused-after "output-sidebar" [:deactivate "output-view"])))))
