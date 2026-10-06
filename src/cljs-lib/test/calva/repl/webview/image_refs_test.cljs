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
    (is (= :local (:image/kind (sut/image-ref "/tmp/my folder/a.png"))))
    (is (= :local (:image/kind (sut/image-ref "file:///tmp/my folder/a.png"))))
    (is (nil? (sut/image-ref "images/notes.txt"))))
  (testing "network file URIs and UNC paths are not image refs"
    (is (nil? (sut/image-ref "file://server/share/x.png")))
    (is (false? (sut/file-image-uri? "file://server/share/x.png")))
    (is (true? (sut/file-image-uri? "file:///tmp/x.png"))))
  (testing "a mention in a longer line does not count"
    (is (nil? (sut/image-ref "look at cat.png now"))))
  (testing "relative paths with whitespace are prose, not paths"
    (is (nil? (sut/image-ref "Wrote chart.png")))
    (is (nil? (sut/image-ref "Saved the chart to out.png")))
    (is (= :local (:image/kind (sut/image-ref "charts/a.png"))))))

(deftest unwrap-printed-string-test
  (is (= "https://example.com/a.png"
         (sut/unwrap-printed-string "\"https://example.com/a.png\"")))
  (is (= "C:\\temp\\new.png"
         (sut/unwrap-printed-string "\"C:\\\\temp\\\\new.png\"")))
  (is (nil? (sut/unwrap-printed-string "https://example.com/a.png")))
  (is (nil? (sut/unwrap-printed-string "\"a.png\" \"b.png\""))
      "a line with two printed strings is not one string form"))

(deftest image-refs-test
  (testing "a whole printed string result"
    (let [images (sut/image-refs "\"https://example.com/a.png\"\n")]
      (is (= 1 (count images)))
      (is (= :remote (:image/kind (first images))))
      (is (= "https://example.com/a.png" (:image/src (first images))))
      (is (= 0 (:image/line-index (first images))))))
  (testing "a whole stdout line"
    (is (= ["/tmp/a.png"] (map :image/src (sut/image-refs "/tmp/a.png\n")))))
  (testing "a mention inside a longer line does not count"
    (is (= [] (sut/image-refs "look: https://example.com/a.png\n"))))
  (testing "two lines carry distinct line indexes"
    (let [images (sut/image-refs "https://a.com/x.png\n/tmp/y.gif\n")]
      (is (= 2 (count images)))
      (is (= [0 1] (map :image/line-index images)))))
  (testing "a Windows path printed as a Clojure string keeps its backslashes"
    (let [line (str (pr-str "C:\\Users\\pez\\a.png") "\n")
          images (sut/image-refs line)]
      (is (= 1 (count images)))
      (is (= "C:\\Users\\pez\\a.png" (:image/src (first images))))
      (is (= 0 (:image/line-index (first images))))))
  (testing "two printed strings on one line are not a whole-line image path"
    (is (= [] (sut/image-refs "\"tmp/a.png\" \"b.png\"\n")))))
