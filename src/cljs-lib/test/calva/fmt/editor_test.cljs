(ns calva.fmt.editor-test
  (:require [cljs.test :include-macros true :refer [deftest is]]
            [calva.fmt.editor :as sut]))


(deftest raplacement-edits-for-diffing-lines
  (is (= []
         (sut/replacement-edits-for-diffing-lines "foo\nfoo\nbar\nbar"
                                                  "foo\nfoo\nbar\nbar")))
  (is (= [{:edit "replace", :start {:line 1, :character 0}, :end {:line 1, :character 6}, :text "bar"}
          {:edit "replace", :start {:line 2, :character 0}, :end {:line 2, :character 3}, :text "baz"}]
         (sut/replacement-edits-for-diffing-lines "foo\nfooooo\nbar\nbar"
                                                  "foo\nbar\nbaz\nbar"))))
