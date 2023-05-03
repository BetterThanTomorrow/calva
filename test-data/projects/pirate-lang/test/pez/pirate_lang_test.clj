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
             (sut/to-pirate-talk "Har du hört talas om rövarspråket?" sut/swedish-o))))))

(deftest b-a-test
  (testing "Hear rövarspråk"
    (is (= "Har du hört talas om rövarspråket?"
           (sut/from-pirate-talk "HoHaror dodu hohörortot totalolasos omom rorövovarorsospoproråkoketot?" sut/swedish-o)))))

(deftest a-test-b
  (println "running a-test-b")
  (is (= 1 1)))