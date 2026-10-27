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

  (testing "a change at the record's version replaces the record's prediction of an edit"
    (is (= "something else"
           (get-in (sut/take-change records {:repl-input/id "output-view"
                                             :version 41
                                             :text "something else"
                                             :selections [[0 0]]})
                   ["output-view" :repl-input/text]))))

  (testing "a change leaves the other REPL Inputs' records alone"
    (is (= record-41
           (get (sut/take-change records {:repl-input/id "output-sidebar"
                                          :version 1
                                          :text "x"
                                          :selections [[1 1]]})
                "output-view")))))

(deftest take-change-keeps-derived-test
  (testing "a change keeps what the extension derived for the record"
    (is (= {"calva:cursorInComment" true}
           (get-in (sut/take-change (assoc-in records ["output-view" :repl-input/cursor-contexts] {"calva:cursorInComment" true})
                                    {:repl-input/id "output-view"
                                     :version 42
                                     :text "(foo) bar baz"
                                     :selections [[5 5]]})
                   ["output-view" :repl-input/cursor-contexts])))))

(deftest take-edit-test
  (testing "an edit of the record's version gives the record the next version, with the edit's text, selections and selection history"
    (is (= {"output-view" {:repl-input/id "output-view"
                           :repl-input/version 42
                           :repl-input/text "(foo bar baz)"
                           :repl-input/selections [[1 4]]
                           :repl-input/selections-stack [[[4 4]] [[1 4]]]}}
           (sut/take-edit records "output-view" 41 {:text "(foo bar baz)"
                                                    :selections [[1 4]]
                                                    :selections-stack [[[4 4]] [[1 4]]]}))))
  (testing "an edit of an older version is dropped, since the REPL Input changed while the command ran"
    (is (= records
           (sut/take-edit records "output-view" 40 {:text "(foo bar baz)" :selections [[4 4]]}))))
  (testing "an edit for a REPL Input without a record is dropped"
    (is (= records
           (sut/take-edit records "output-sidebar" 0 {:text "x" :selections [[1 1]]})))))

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

(deftest restored-test
  (testing "gives back the text and selections a record keeps"
    (is (= {:text "(foo) bar baz" :selections [[4 4]]}
           (sut/restored {:repl-input/text "(foo) bar baz" :repl-input/selections [[4 4]] :repl-input/version 41}))))
  (testing "gives back nothing for an empty record, or none"
    (is (nil? (sut/restored {:repl-input/text "" :repl-input/selections [[0 0]]})))
    (is (nil? (sut/restored nil)))))
