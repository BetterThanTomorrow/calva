(ns calva.repl.input.records-test
  (:require
   [calva.repl.input.records :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def record-41
  {:repl-input/id "output-view"
   :repl-input/version 41
   :repl-input/text "(foo) bar baz"
   :repl-input/selections [[4 4]]})

(def records {"output-view" record-41})

(deftest take-change-test
  (testing "a change for a REPL Input without a record creates its record"
    (is (= {"output-sidebar" {:repl-input/id "output-sidebar"
                              :repl-input/version 1
                              :repl-input/text "("
                              :repl-input/selections [[1 1]]}}
           (sut/take-change {} {:repl-input/id "output-sidebar"
                                :version 1
                                :text "("
                                :selections [[1 1]]}))))

  (testing "a newer version replaces the text, the selections and the version"
    (is (= {"output-view" {:repl-input/id "output-view"
                           :repl-input/version 42
                           :repl-input/text "(foo bar) baz"
                           :repl-input/selections [[8 8] [13 13]]}}
           (sut/take-change records {:repl-input/id "output-view"
                                     :version 42
                                     :text "(foo bar) baz"
                                     :selections [[8 8] [13 13]]}))))

  (testing "an older version is dropped"
    (is (= records
           (sut/take-change records {:repl-input/id "output-view"
                                     :version 40
                                     :text "(foo) bar"
                                     :selections [[0 0]]}))))

  (testing "the version the record already has is dropped"
    (is (= records
           (sut/take-change records {:repl-input/id "output-view"
                                     :version 41
                                     :text "something else"
                                     :selections [[0 0]]}))))

  (testing "a change leaves the other REPL Inputs' records alone"
    (is (= record-41
           (get (sut/take-change records {:repl-input/id "output-sidebar"
                                          :version 1
                                          :text "x"
                                          :selections [[1 1]]})
                "output-view")))))

(deftest take-mount-test
  (testing "a mount replaces the record whatever its version, since a mounted REPL Input starts over"
    (is (= {"output-view" {:repl-input/id "output-view"
                           :repl-input/version 0
                           :repl-input/text ""
                           :repl-input/selections [[0 0]]}}
           (sut/take-mount records {:repl-input/id "output-view"
                                    :version 0
                                    :text ""
                                    :selections [[0 0]]})))))

(deftest remove-record-test
  (testing "removing a REPL Input's record leaves the others"
    (is (= {"output-view" record-41}
           (sut/remove-record (assoc records "output-sidebar" {:repl-input/id "output-sidebar"})
                              "output-sidebar")))))
