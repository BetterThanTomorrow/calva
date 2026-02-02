(ns calva.read-config-test
  (:require [cljs.test :refer [deftest is testing]]
            [calva.read-config :as sut]))

(deftest config-edn->js-test
  (testing "accepts kebab-case keys and converts to camelCase"
    (let [result (js->clj (sut/config-edn->js "{:custom-pair-forms [{:type :flat :name assoc :offset 2}]}")
                          :keywordize-keys false)]
      (is (contains? result "customPairForms"))
      (is (= 1 (count (get result "customPairForms"))))
      (is (= "flat" (get (first (get result "customPairForms")) "type")))))

  (testing "accepts camelCase keys"
    (let [result (js->clj (sut/config-edn->js "{:customPairForms [{:type :flat :name assoc :offset 2}]}")
                          :keywordize-keys false)]
      (is (contains? result "customPairForms"))))

  (testing "converts nested keys in custom-pair-forms"
    (let [result (js->clj (sut/config-edn->js "{:custom-pair-forms [{:type :keyword :keyword :let :valid-parents [for doseq]}]}")
                          :keywordize-keys false)]
      (is (contains? result "customPairForms"))
      (let [form (first (get result "customPairForms"))]
        (is (= "keyword" (get form "type")))
        (is (contains? form "validParents")))))

  (testing "converts nested threading macros keys"
    (let [result (js->clj (sut/config-edn->js "{:custom-threading-macros {:first-arg [my->] :last-arg [my->>]}}")
                          :keywordize-keys false)]
      (is (contains? result "customThreadingMacros"))
      (let [macros (get result "customThreadingMacros")]
        (is (contains? macros "firstArg"))
        (is (contains? macros "lastArg")))))

  (testing "handles mixed kebab and camelCase keys"
    (let [result (js->clj (sut/config-edn->js "{:custom-pair-forms [{:type :flat :name assoc}] :customThreadingMacros {:firstArg [->]}}")
                          :keywordize-keys false)]
      (is (contains? result "customPairForms"))
      (is (contains? result "customThreadingMacros"))))

  (testing "handles REPL snippets with kebab-case"
    (let [result (js->clj (sut/config-edn->js "{:custom-repl-command-snippets [{:name \"test\" :snippet \"(+ 1 2)\"}]}")
                          :keywordize-keys false)]
      (is (contains? result "customReplCommandSnippets"))))

  (testing "handles REPL snippets with camelCase (backward compatibility)"
    (let [result (js->clj (sut/config-edn->js "{:customREPLCommandSnippets [{:name \"test\" :snippet \"(+ 1 2)\"}]}")
                          :keywordize-keys false)]
      (is (contains? result "customREPLCommandSnippets")))))
