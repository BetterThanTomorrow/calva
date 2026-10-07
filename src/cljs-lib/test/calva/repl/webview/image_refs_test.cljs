(ns calva.repl.webview.image-refs-test
  (:require
   [calva.repl.webview.image-refs :as sut]
   [cljs.test :refer-macros [deftest testing is]]
   [clojure.string :as str]))

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

(deftest result-image-refs-test
  (testing "a map with a relative path and a remote URL"
    (let [text (pr-str {:icon "calva-symbol.svg" :logo "https://example.com/x.png"})
          images (sut/result-image-refs text)]
      (is (= ["calva-symbol.svg" "https://example.com/x.png"] (mapv :image/src images)))
      (is (= [:local :remote] (mapv :image/kind images)))))
  (testing "a vector of paths"
    (is (= ["tmp/a.png" "tmp/b.png"]
           (mapv :image/src (sut/result-image-refs (pr-str ["tmp/a.png" "tmp/b.png"]))))))
  (testing "a nested map keeps appearance order"
    (let [text (pr-str {:a {:p "tmp/a.png"} :b ["tmp/b.gif" "https://ex.com/c.webp"]})]
      (is (= ["tmp/a.png" "tmp/b.gif" "https://ex.com/c.webp"]
             (mapv :image/src (sut/result-image-refs text))))))
  (testing "a string key counts the same as a value"
    (is (= ["calva-symbol.svg"]
           (mapv :image/src (sut/result-image-refs (pr-str {"calva-symbol.svg" :ok}))))))
  (testing "a non-image string and a longer string containing a path get no row"
    (is (= [] (sut/result-image-refs (pr-str {:x "notes.txt"}))))
    (is (= [] (sut/result-image-refs (pr-str "look at cat.png")))))
  (testing "pretty-printed strings keep line indexes in appearance order"
    (let [text "{:icon \"calva-symbol.svg\"\n :logo \"https://example.com/x.png\"}"
          images (sut/result-image-refs text)]
      (is (= ["calva-symbol.svg" "https://example.com/x.png"] (mapv :image/src images)))
      (is (= [0 1] (mapv :image/line-index images)))))
  (testing "whole-line refs still count, without duplicating a whole-line printed string"
    (let [text (str (pr-str "https://example.com/a.png") "\n")
          images (sut/result-image-refs text)]
      (is (= 1 (count images)))
      (is (= "https://example.com/a.png" (:image/src (first images)))))
    (is (= ["/tmp/bare.png"]
           (mapv :image/src (sut/result-image-refs "/tmp/bare.png\n")))))
  (testing "stdout keeps the whole-line rule: nested strings are not image-refs"
    (is (= [] (sut/image-refs (pr-str {:icon "calva-symbol.svg"})))))
  (testing "a character literal quote does not hide later image strings"
    (let [bs "\\"
          q "\""
          vec-text (str "[" bs q " " q "x.png" q "]")
          map-text (str "{:a " bs q ", :c " q "bar.png" q "}")
          te-vec (str "[" bs q " " q "a.png" q " " q "b.png" q "]")
          te-map (str "{:q " bs q ", :icon " q "calva-symbol.svg" q "}")]
      (is (= ["x.png"] (mapv :image/src (sut/result-image-refs vec-text))))
      (is (= ["bar.png"] (mapv :image/src (sut/result-image-refs map-text))))
      (is (= ["a.png" "b.png"] (mapv :image/src (sut/result-image-refs te-vec))))
      (is (= ["calva-symbol.svg"] (mapv :image/src (sut/result-image-refs te-map))))))
  (testing "a printed regex is not an image string"
    (let [q "\""
          text (str "[#" q "cat.png" q " " q "y.png" q "]")]
      (is (= ["y.png"] (mapv :image/src (sut/result-image-refs text))))))
  (testing "a printed tagged value still counts as an image string"
    (let [q "\""
          text (str "#my/tag " q "x.png" q)]
      (is (= ["x.png"] (mapv :image/src (sut/result-image-refs text))))))
  (testing "repeated identical strings keep one row each"
    (is (= ["tmp/a.png" "tmp/a.png"]
           (mapv :image/src (sut/result-image-refs (pr-str ["tmp/a.png" "tmp/a.png"]))))))
  (testing "a result over 1 MB uses the whole-line rule"
    (let [nested (pr-str {:icon "a.png"})
          text (str (apply str (repeat 1048577 "x")) "\n" nested)
          whole-line (str (apply str (repeat 1048577 "x")) "\n\"a.png\"\n")]
      (is (= [] (mapv :image/src (sut/result-image-refs text))))
      (is (= ["a.png"] (mapv :image/src (sut/result-image-refs whole-line))))))
  (testing "100,000 matching strings stay fast and give 50 rows"
    ;; 5 s only catches a quadratic regression; the margin avoids flakes under load.
    (let [text (pr-str (vec (repeat 100000 "a.png")))
          t0 (.now js/Date)
          images (sut/result-image-refs text)
          elapsed (- (.now js/Date) t0)]
      (is (= 50 (count images)))
      (is (= (vec (repeat 50 "a.png")) (mapv :image/src images)))
      (is (= (vec (repeat 50 0)) (mapv :image/line-index images)))
      (is (< elapsed 5000)
          (str "expected under 5000ms, took " elapsed "ms"))))
  (testing "the cap keeps the first 50 in order, with their line indexes"
    (let [text (str/join "\n" (map #(str "\"line-" % ".png\"") (range 60)))
          images (sut/result-image-refs text)]
      (is (= 50 (count images)))
      (is (= (mapv #(str "line-" % ".png") (range 50)) (mapv :image/src images)))
      (is (= (vec (range 50)) (mapv :image/line-index images))))))
