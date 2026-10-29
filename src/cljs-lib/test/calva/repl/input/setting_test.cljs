(ns calva.repl.input.setting-test
  (:require
   [calva.repl.input.setting :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest enabled?-test
  (testing "the setting has the REPL Input on or off per view"
    (is (true? (sut/enabled? {"output-view" true "output-sidebar" false} "output-view")))
    (is (false? (sut/enabled? {"output-view" true "output-sidebar" false} "output-sidebar"))))

  (testing "a view the setting leaves out is off"
    (is (false? (sut/enabled? {} "output-view")))
    (is (false? (sut/enabled? nil "output-view")))))
