(ns pez-rewrite-clj.node-test
  (:require [cljs.test :refer-macros [deftest is testing run-tests]]
            [pez-rewrite-clj.node :as n]
            [pez-rewrite-clj.parser :as p]))


(deftest namespaced-keyword
  (is (= ":dill/dall"
         (n/string (n/keyword-node :dill/dall)))))

(deftest funky-keywords
  (is (= ":%dummy.*"
         (n/string (n/keyword-node :%dummy.*)))))

(deftest regex-node
  (let [sample "(re-find #\"(?i)RUN\" s)"
        sample2 "(re-find #\"(?m)^rss\\s+(\\d+)$\")"
        sample3 "(->> (str/split container-name #\"/\"))"]
    (is (= sample (-> sample p/parse-string n/string)))
    (is (= sample2 (-> sample2 p/parse-string n/string)))
    (is (= sample3 (-> sample3 p/parse-string n/string)))))


(deftest regex-with-newlines
  (let [sample "(re-find #\"Hello
        \\nJalla\")"]
    (is (= sample (-> sample p/parse-string n/string)))))



(deftest reader-conditionals
  (testing "Simple reader conditional"
    (let [sample "#?(:clj bar)"
          res (p/parse-string sample)]
      (is (= sample (n/string res)))
      (is (= :reader-macro (n/tag res)))
      (is (= [:token :list] (map n/tag (n/children res))))))

  (testing "Reader conditional with space before list"
    (let [sample "#? (:clj bar)"
          sample2 "#?@ (:clj bar)"]
      (is (= sample (-> sample p/parse-string n/string)))
      (is (= sample2 (-> sample2 p/parse-string n/string)))))


  (testing "Reader conditional with splice"
    (let [sample
"(:require [clojure.string :as s]
           #?@(:clj  [[clj-time.format :as tf]
                      [clj-time.coerce :as tc]]
               :cljs [[cljs-time.coerce :as tc]
                      [cljs-time.format :as tf]]))"
          res (p/parse-string sample)]
      (is (= sample (n/string res))))))

