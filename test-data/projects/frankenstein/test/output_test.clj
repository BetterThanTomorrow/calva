(ns output-test
  (:require [clojure.test :refer [deftest is testing]]))

(deftest extra-lines
  ;; Test that Calva doesn't add or remove whitespace from test output
  ;; NB: "seven" and "eight" are lost, we never get them back from the nREPL server, I think
  (testing "printing w/ retained whitespace"
    (is (nil? (do
                (print "one")
                (println "two")
                (println "three")
                (print "  four")
                (println "  five")
                (println "  six")
                (print "seven")
                (print "eight"))))))