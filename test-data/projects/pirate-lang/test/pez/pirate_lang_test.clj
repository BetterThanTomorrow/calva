(ns pez.pirate-lang-test
  (:require [clojure.test :refer [deftest is testing]]
            [pez.pirate-lang :as sut]))

(def swedish-o {:alphabet    "abcdefghijklmnopqrstuvwxyzåäö"
                :vowels      "aeiouåäö"
                :pirate-char "o"})
(deftest a-test
  (testing "Speak rövarspråk"
    (testing "Swedish"
      (is (= "HoHaror dodu hohörortot totalolasos omom rorövovarorsospoproråkoketot?"
             (sut/to-pirate-talk "Har du hört talas om rövarspråket?" sut/swedish-o)))))
  (testing "Hear rövarspråk"
    (is (= "Har du hört talas om rövarspråket?"
           (sut/from-pirate-talk "HoHaror dodu hohörortot totalolasos omom rorövovarorsospoproråkoketot?" sut/swedish-o)))))

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
