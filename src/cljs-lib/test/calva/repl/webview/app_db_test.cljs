(ns calva.repl.webview.app-db-test
  (:require
   [calva.repl.webview.app-db :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest initial-db-test
  (testing "initial-db has nil :output/last-context"
    (is (nil? (:output/last-context sut/initial-db)))))

(deftest handle-action-test
  (testing ":msg/clear-output-view action"
    (let [db {:output/last-context ["who" "session" "build" 1 "my.ns"]}
          result (sut/handle-action db [:msg/clear-output-view])]
      (is (nil? (get-in result [:uf/db :output/last-context])))
      (is (= [[:fx/clear-dom]] (:uf/fxs result)))))

  (testing ":msg/output with new context"
    (let [meta {:meta/who "tester" :meta/ns "my.ns" :meta/repl-session-key "clj"}
          payload {:command/name "show-result" :output "42" :meta meta}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= ["tester" "clj" nil nil "my.ns"] (get-in result [:uf/db :output/last-context])))
      (is (= [[:fx/append-ns-info meta]
              [:fx/append-result "42"]]
             (:uf/fxs result)))))

  (testing ":msg/output with unchanged context"
    (let [meta {:meta/who "tester" :meta/ns "my.ns" :meta/repl-session-key "clj"}
          db {:output/last-context ["tester" "clj" nil nil "my.ns"]}
          payload {:command/name "show-result" :output "42" :meta meta}
          result (sut/handle-action db [:msg/output payload])]
      (is (= ["tester" "clj" nil nil "my.ns"] (get-in result [:uf/db :output/last-context])))
      (is (= [[:fx/append-result "42"]] (:uf/fxs result)))))

  (testing ":msg/output show-stdout with an output-category"
    (let [payload {:command/name "show-stdout" :output "text" :output-category "otherOut"}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= [[:fx/append-stdout "text" "otherOut"]] (:uf/fxs result)))))

  (testing ":msg/output show-stdout without an output-category defaults to evalOut"
    (let [payload {:command/name "show-stdout" :output "text"}
          result (sut/handle-action sut/initial-db [:msg/output payload])]
      (is (= [[:fx/append-stdout "text" "evalOut"]] (:uf/fxs result)))))

  (testing ":msg/set-code-theme"
    (let [result (sut/handle-action sut/initial-db [:msg/set-code-theme {:code-theme "dark"}])]
      (is (= sut/initial-db (:uf/db result)))
      (is (= [[:fx/set-code-theme "dark"]] (:uf/fxs result)))))

  (testing ":msg/set-word-wrap"
    (let [result (sut/handle-action sut/initial-db [:msg/set-word-wrap {:word-wrap true}])]
      (is (= sut/initial-db (:uf/db result)))
      (is (= [[:fx/set-word-wrap true]] (:uf/fxs result)))))

  (testing ":msg/scroll-to"
    (let [result (sut/handle-action sut/initial-db [:msg/scroll-to {:x 0 :y 100}])]
      (is (= sut/initial-db (:uf/db result)))
      (is (= [[:fx/scroll-to {:x 0 :y 100}]] (:uf/fxs result))))))

(deftest compute-effective-scale-test
  (testing "combines base scale and adjustment"
    (is (= 1.1 (sut/compute-effective-scale {:output/base-font-scale 1.0 :output/font-size-adjustment 0.1}))))

  (testing "defaults missing keys to 1.0 and 0.0"
    (is (= 1.0 (sut/compute-effective-scale {}))))

  (testing "clamps to a minimum of 0.5"
    (is (= 0.5 (sut/compute-effective-scale {:output/base-font-scale 0.4 :output/font-size-adjustment -0.5}))))

  (testing "clamps to a maximum of 1.5"
    (is (= 1.5 (sut/compute-effective-scale {:output/base-font-scale 1.4 :output/font-size-adjustment 0.5}))))

  (testing "rounds to two decimal places"
    (is (= 1.23 (sut/compute-effective-scale {:output/base-font-scale 1.0 :output/font-size-adjustment 0.234})))))

(deftest set-base-font-scale-test
  (testing ":msg/set-base-font-scale sets the base scale and returns the effective scale fx"
    (let [result (sut/handle-action sut/initial-db [:msg/set-base-font-scale {:scale 1.5}])]
      (is (= 1.5 (get-in result [:uf/db :output/base-font-scale])))
      (is (= [[:fx/set-font-scale 1.5]] (:uf/fxs result)))))

  (testing "defaults to 1.0 when no scale is given"
    (let [result (sut/handle-action sut/initial-db [:msg/set-base-font-scale {}])]
      (is (= 1.0 (get-in result [:uf/db :output/base-font-scale])))
      (is (= [[:fx/set-font-scale 1.0]] (:uf/fxs result))))))

(deftest adjust-font-size-test
  (testing ":msg/adjust-font-size increases the adjustment by the given delta"
    (let [result (sut/handle-action sut/initial-db [:msg/adjust-font-size {:delta 0.1}])]
      (is (= 0.1 (get-in result [:uf/db :output/font-size-adjustment])))
      (is (= [[:fx/set-font-scale 1.1]] (:uf/fxs result)))))

  (testing "accumulates on top of an existing adjustment"
    (let [db (assoc sut/initial-db :output/font-size-adjustment 0.2)
          result (sut/handle-action db [:msg/adjust-font-size {:delta 0.1}])]
      (is (< (js/Math.abs (- 0.3 (get-in result [:uf/db :output/font-size-adjustment]))) 0.0001))))

  (testing "defaults to a delta of 0.1 when none given"
    (let [result (sut/handle-action sut/initial-db [:msg/adjust-font-size {}])]
      (is (= 0.1 (get-in result [:uf/db :output/font-size-adjustment]))))))

(deftest reset-font-size-test
  (testing ":msg/reset-font-size resets the adjustment to 0.0"
    (let [db (assoc sut/initial-db :output/font-size-adjustment 0.5)
          result (sut/handle-action db [:msg/reset-font-size {}])]
      (is (= 0.0 (get-in result [:uf/db :output/font-size-adjustment])))
      (is (= [[:fx/set-font-scale 1.0]] (:uf/fxs result))))))
