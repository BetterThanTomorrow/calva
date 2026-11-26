(ns calva.repl.webview.input.definition-test
  (:require
   [calva.repl.webview.input.definition :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def click {:button 0 :alt? false :ctrl? false :meta? false :shift? false})

(deftest definition-click?-test
  (testing "with alt adding cursors, cmd+click goes to the definition on macOS, and ctrl+click elsewhere"
    (is (true? (sut/definition-click? {:multi-cursor-modifier "alt" :mac? true} (assoc click :meta? true))))
    (is (true? (sut/definition-click? {:multi-cursor-modifier "alt" :mac? false} (assoc click :ctrl? true))))
    (is (false? (sut/definition-click? {:multi-cursor-modifier "alt" :mac? true} (assoc click :alt? true)))))
  (testing "with cmd or ctrl adding cursors, alt+click goes to the definition"
    (is (true? (sut/definition-click? {:multi-cursor-modifier "ctrlCmd" :mac? true} (assoc click :alt? true))))
    (is (false? (sut/definition-click? {:multi-cursor-modifier "ctrlCmd" :mac? true} (assoc click :meta? true)))))
  (testing "a click without the modifier, with shift, or with another button stays a click"
    (is (false? (sut/definition-click? {:multi-cursor-modifier "alt" :mac? true} click)))
    (is (false? (sut/definition-click? {:multi-cursor-modifier "alt" :mac? true} (assoc click :meta? true :shift? true))))
    (is (false? (sut/definition-click? {:multi-cursor-modifier "alt" :mac? true} (assoc click :meta? true :button 2))))))
