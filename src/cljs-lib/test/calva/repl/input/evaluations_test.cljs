(ns calva.repl.input.evaluations-test
  (:require
   [calva.repl.input.evaluations :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest next-id-test
  (testing "is the time now, so that ids stay unique across restarts"
    (is (= 1700000000000 (sut/next-id nil 1700000000000))))

  (testing "is after the last id when two evaluations start in the same millisecond"
    (is (= 1700000000001 (sut/next-id 1700000000000 1700000000000)))))

(deftest bar-test
  (testing "shows nothing while no evaluation runs"
    (is (nil? (sut/bar {} "output-view"))))

  (testing "shows that an evaluation runs, only for the REPL Input that started it"
    (let [evaluations (sut/started {} "output-view" 1)]
      (is (= :running (sut/bar evaluations "output-view")))
      (is (nil? (sut/bar evaluations "output-sidebar")))))

  (testing "shows that stdin is read while an evaluation waits for a line"
    (is (= :reading-stdin (-> {}
                              (sut/started "output-view" 1)
                              (sut/started "output-view" 2)
                              (sut/reading-stdin "output-view" 2 true)
                              (sut/bar "output-view")))))

  (testing "goes back to running when the line is sent"
    (is (= :running (-> {}
                        (sut/started "output-view" 1)
                        (sut/reading-stdin "output-view" 1 true)
                        (sut/reading-stdin "output-view" 1 false)
                        (sut/bar "output-view")))))

  (testing "shows nothing when the evaluations have finished"
    (is (= {} (-> {}
                  (sut/started "output-view" 1)
                  (sut/started "output-view" 2)
                  (sut/finished "output-view" 1)
                  (sut/finished "output-view" 2))))))

(deftest reading-stdin-test
  (testing "leaves out an evaluation that has finished"
    (is (= {} (-> {}
                  (sut/started "output-view" 1)
                  (sut/finished "output-view" 1)
                  (sut/reading-stdin "output-view" 1 true))))))

(deftest waiting-for-stdin-test
  (testing "is the evaluation that waits for a line"
    (is (= 2 (-> {}
                 (sut/started "output-view" 1)
                 (sut/started "output-view" 2)
                 (sut/reading-stdin "output-view" 2 true)
                 (sut/waiting-for-stdin "output-view")))))

  (testing "is nil while no evaluation waits"
    (is (nil? (-> {}
                  (sut/started "output-view" 1)
                  (sut/waiting-for-stdin "output-view"))))))
