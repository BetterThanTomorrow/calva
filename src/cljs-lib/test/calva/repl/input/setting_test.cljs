(ns calva.repl.input.setting-test
  (:require
   [calva.repl.input.setting :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest enabled?-test
  (testing "the setting has the REPL Input on or off per view"
    (is (true? (sut/enabled? {"output-view" true "output-sidebar" false} {} "output-view")))
    (is (false? (sut/enabled? {"output-view" true "output-sidebar" false} {} "output-sidebar"))))

  (testing "a view the setting leaves out is off"
    (is (false? (sut/enabled? {} {} "output-view")))
    (is (false? (sut/enabled? nil {} "output-view"))))

  (testing "a toggle for the session wins over the setting"
    (is (true? (sut/enabled? {"output-view" false} {"output-view" true} "output-view")))
    (is (false? (sut/enabled? {"output-view" true} {"output-view" false} "output-view")))))

(deftest any-enabled?-test
  (testing "true when the setting has the REPL Input on for at least one view"
    (is (true? (sut/any-enabled? {"output-view" false "output-sidebar" true})))
    (is (false? (sut/any-enabled? {"output-view" false "output-sidebar" false})))
    (is (false? (sut/any-enabled? nil)))))

(deftest toggle-test
  (testing "toggling a view flips what it has now, setting or earlier toggle"
    (is (= {"output-sidebar" true}
           (sut/toggle {"output-view" true} {} "output-sidebar")))
    (is (= {"output-view" false}
           (sut/toggle {"output-view" true} {} "output-view")))
    (is (= {"output-view" true}
           (sut/toggle {"output-view" true} {"output-view" false} "output-view")))))
