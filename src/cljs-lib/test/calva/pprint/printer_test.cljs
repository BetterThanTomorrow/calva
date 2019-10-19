(ns calva.pprint.printer-test
  (:require [cljs.test :include-macros true :refer [testing deftest is]]
            [calva.pprint.printer :as sut]))

(deftest pretty-print
  (testing "Parses strings"
    (is (= (sut/pretty-print :foo) (sut/pretty-print ":foo"))))
  
  (testing "Pretty prints"
    (let [result (sut/pretty-print (repeat 5 (repeat 5 {:foo :bar})) 15)]
      (is (re-find #"\n" (:value result)))
      (is (nil? (:error result)))))
  
  (testing "Prints original on pprint error"
    (let [croaking-s "{:db-before datomic.db.Db@f76b7417, :db-after datomic.db.Db@9ac71f6, :tx-data [#datom[13194139534320 50 #inst \"2019-10-19T16:22:36.906-00:00\" 13194139534320 true] #datom[17592186045425 62 \"Hello world\" 13194139534320 true]], :tempids {-9223301668109598139 17592186045425}}"]
      (is (= croaking-s (:value (sut/pretty-print croaking-s))))
      (is (some? (:error (sut/pretty-print croaking-s)))))))
