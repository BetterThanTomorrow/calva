(ns pez.pirate-talk-test
  (:require [clojure.test :refer [deftest is testing]]
            [pez.pirate-talk :as sut]))

(def swedish-o {:alphabet    "abcdefghijklmnopqrstuvwxyzåäö"
                :vowels      "aeiouåäö"
                :pirate-char "o"})
(deftest a-test
  (testing "Speak rövarspråk"
    (is (= "HoHaror dodu hohörortot totalolasos omom rorövovarorsospoproråkoketot?"
           (sut/to-pirate-talk "Har du hört talas om rövarspråket?" sut/swedish-o))))
  (testing "Hear rövarspråk"
    (is (= "Har du hört talas om rövarspråket?"
           (sut/from-pirate-talk "HoHaror dodu hohörortot totalolasos omom rorövovarorsospoproråkoketot?" sut/swedish-o)))))
