(ns calva.repl.webview.app-db-test
  (:require
   [calva.repl.webview.app-db :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest app-db-test
  (testing "initial-db has nil :output/last-context"
    (is (nil? (:output/last-context sut/initial-db))))
  (testing "set-last-context updates :output/last-context"
    (let [ctx ["who" "session" "build" 1 "my.ns"]
          updated (sut/set-last-context sut/initial-db ctx)]
      (is (= ctx (:output/last-context updated)))))
  (testing "clear-last-context sets :output/last-context to nil"
    (let [db {:output/last-context ["who" "session" "build" 1 "my.ns"]}
          cleared (sut/clear-last-context db)]
      (is (nil? (:output/last-context cleared))))))
