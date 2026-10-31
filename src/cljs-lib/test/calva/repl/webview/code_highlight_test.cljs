(ns calva.repl.webview.code-highlight-test
  (:require
   [calva.repl.webview.code-highlight :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest look-class-test
  (testing "gives the color's class and a class for each font style"
    (is (= "code-color-ff7b72 code-bold code-italic" (sut/look-class "#ff7b72" #{:italic :bold}))))
  (testing "gives a class for each of the four font styles"
    (is (= "code-bold code-italic code-strikethrough code-underline"
           (sut/look-class nil #{:bold :italic :underline :strikethrough}))))
  (testing "has a rule for underline and strikethrough together, since each sets the text decoration"
    (is (some #(re-find #"\.code-underline\.code-strikethrough \{ text-decoration: underline line-through;" %)
              sut/font-style-css)))
  (testing "gives font style classes without a color"
    (is (= "code-underline" (sut/look-class nil #{:underline}))))
  (testing "gives nothing for neither, or for unknown styles"
    (is (nil? (sut/look-class nil nil)))
    (is (nil? (sut/look-class "red" #{:blink})))))

(deftest color-class-test
  (testing "gives a hex color a class"
    (is (= "code-color-ff7b72" (sut/color-class "#FF7B72")))
    (is (= "code-color-ff7b72cc" (sut/color-class "#ff7b72cc"))))
  (testing "gives no class for anything but a hex color"
    (is (nil? (sut/color-class "red")))
    (is (nil? (sut/color-class "#fff; } body { color: red")))
    (is (nil? (sut/color-class nil)))))

(deftest spans-test
  (testing "wraps the ranges in spans with their classes, and keeps the text between them"
    (is (= ["(" [:span {:class "code-color-ff7b72"} "let"] " [" [:span {:class "code-color-79c0ff code-italic"} ":a"] "])"]
           (sut/spans "(let [:a])" [[1 4 "#ff7b72" nil] [6 8 "#79c0ff" #{:italic}]]))))
  (testing "keeps a range without a class as text"
    (is (= ["ab"] (sut/spans "ab" [])))
    (is (= ["a" "b"] (sut/spans "ab" [[0 1 nil nil]])))))

(deftest spans-marks-test
  (testing "lays the marks' classes over the ranges', splitting them where the marks start and end"
    (is (= [[:span {:class "code-color-ff7b72 code-bracket-0"} "("]
            [:span {:class "code-color-ff7b72"} "le"]
            "t"
            [:span {:class "code-comment-form"} " x"]
            [:span {:class "code-comment-form code-bracket-0"} ")"]]
           (sut/spans "(let x)" [[0 3 "#ff7b72" nil]] [[0 1 "code-bracket-0"] [4 7 "code-comment-form"] [6 7 "code-bracket-0"]])))))
