(ns calva.state-test
  (:require [cljs.test :refer [testing deftest is use-fixtures]]
            [calva.state :as state]))

(use-fixtures :each
  {:before (fn [] (reset! state/state {}))})

(deftest set-state-value!-test
  (testing "Should write value to state, given key"
    (state/set-state-value! "hello" "world")
    (is (= {"hello" "world"} @state/state))))

(deftest remove-state-value!-test
  (testing "Should remove value from state, given key"
    (reset! state/state {"hello" "world"})
    (state/remove-state-value! "hello")
    (is (= {} @state/state))))

(deftest get-state-value-test
  (testing "Should get value from state, given key"
    (reset! state/state {"hello" "world"})
    (is (= "world" (state/get-state-value "hello")))))

(deftest get-state-test
  (testing "Should return all state"
    (let [all-state {"hello" "world" "fizz" "buzz"}]
      (reset! state/state all-state)
      (is (= all-state (state/get-state))))))

(comment
  (state/get-state))