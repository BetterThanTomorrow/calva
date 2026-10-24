(ns calva.repl.webview.input.history-test
  (:require
   [calva.repl.webview.input.history :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def ^:private on-line-2-of-3 {:cursors 1 :cursor-line 2 :line-count 3 :completion-open? false})

(deftest walk-direction-test
  (testing "up on the first line walks back, down on the last line walks forward"
    (is (= :back (sut/walk-direction (assoc on-line-2-of-3 :key :up :cursor-line 1))))
    (is (= :forward (sut/walk-direction (assoc on-line-2-of-3 :key :down :cursor-line 3))))
    (is (= [:back :forward] (map #(sut/walk-direction {:key % :cursors 1 :cursor-line 1 :line-count 1}) [:up :down]))))
  (testing "moves the cursor between the first and the last line"
    (is (nil? (sut/walk-direction (assoc on-line-2-of-3 :key :up))))
    (is (nil? (sut/walk-direction (assoc on-line-2-of-3 :key :down)))))
  (testing "leaves the keys to the cursors when there are several, and to the open completion list"
    (is (nil? (sut/walk-direction (assoc on-line-2-of-3 :key :up :cursor-line 1 :cursors 2))))
    (is (nil? (sut/walk-direction (assoc on-line-2-of-3 :key :up :cursor-line 1 :completion-open? true))))))
