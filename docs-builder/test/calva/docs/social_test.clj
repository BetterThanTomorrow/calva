(ns calva.docs.social-test
  (:require [calva.docs.social :as social]
            [clojure.java.io :as io]
            [clojure.test :refer [deftest is testing]])
  (:import [javax.imageio ImageIO]))

(deftest wrap-words
  (let [fits? #(<= (count %) 10)]
    (testing "fills each line with the words that fit"
      (is (= ["one two" "three four" "five"] (social/wrap-words fits? "one two three four five"))))
    (testing "a word too long for a line gets a line of its own"
      (is (= ["a" "elevenchars" "b"] (social/wrap-words fits? "a elevenchars b"))))))

(deftest card-png
  (let [site {:site/name "Calva User Guide"
              :site/description "The site"
              :social-card/logo "<svg viewBox=\"0 0 10 10\"><path d=\"M1 1V9C2 9 3 9 9 9Z\" fill=\"#FFFAF4\"/></svg>"
              :social-card/font-files {:bold (io/file "resources/fonts/Roboto-Bold.ttf")
                                       :regular (io/file "resources/fonts/Roboto-Regular.ttf")}
              :social-card/background-color "#db9550"
              :social-card/color "#fafafa"}
        image (ImageIO/read (io/input-stream (social/card-png site {:page/title "Extension API"})))]
    (is (= [1200 630] [(.getWidth image) (.getHeight image)]))
    (is (= 0xffdb9550 (bit-and 0xffffffff (.getRGB image 5 5))))))
