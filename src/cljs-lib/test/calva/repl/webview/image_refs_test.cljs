(ns calva.repl.webview.image-refs-test
  (:require
   [calva.repl.webview.image-refs :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest image-ref-test
  (testing "http and https URLs whose path ends in an image extension"
    (is (= :remote (:image/kind (sut/image-ref "https://example.com/cat.png"))))
    (is (= :remote (:image/kind (sut/image-ref "http://example.com/cat.JPG"))))
    (is (= "jpeg" (:image/subtype (sut/image-ref "https://example.com/a.jpg?size=1"))))
    (is (nil? (sut/image-ref "https://example.com/cat")))
    (is (nil? (sut/image-ref "see https://example.com/cat.png"))))
  (testing "file URIs and paths"
    (is (= :local (:image/kind (sut/image-ref "file:///tmp/cat.png"))))
    (is (= :local (:image/kind (sut/image-ref "/tmp/cat.webp"))))
    (is (= :local (:image/kind (sut/image-ref "images/cat.gif"))))
    (is (nil? (sut/image-ref "images/notes.txt"))))
  (testing "a mention in a longer token does not count"
    (is (nil? (sut/image-ref "look at cat.png now")))))

(deftest unwrap-printed-string-test
  (is (= "https://example.com/a.png"
         (sut/unwrap-printed-string "\"https://example.com/a.png\"")))
  (is (nil? (sut/unwrap-printed-string "https://example.com/a.png"))))

(deftest image-refs-test
  (testing "a whole printed string result"
    (let [images (sut/image-refs "\"https://example.com/a.png\"\n")]
      (is (= 1 (count images)))
      (is (= :remote (:image/kind (first images))))
      (is (= "https://example.com/a.png" (:image/src (first images))))))
  (testing "a whole stdout line"
    (is (= ["/tmp/a.png"] (map :image/src (sut/image-refs "/tmp/a.png\n")))))
  (testing "a mention inside a longer line does not count"
    (is (= [] (sut/image-refs "look: https://example.com/a.png\n"))))
  (testing "two lines"
    (is (= 2 (count (sut/image-refs "https://a.com/x.png\n/tmp/y.gif\n"))))))
