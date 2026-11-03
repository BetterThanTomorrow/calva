(ns calva.repl.webview.auto-scroll-test
  (:require
   [calva.repl.webview.auto-scroll :as sut]
   [calva.repl.webview.fake-document :as fake-document]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest set-anchoring!-test
  (let [scroller (fake-document/hiccup-element [:div {:id "output-scroller"}])
        get-element-by-id (.-getElementById js/document)
        anchoring (fn [] [(.. scroller -style -overflowAnchor) (.. js/document -documentElement -style -overflowAnchor)])]
    (set! (.-getElementById js/document) (fn [id] (when (= "output-scroller" id) scroller)))
    (try
      (sut/set-anchoring! true)
      (is (= ["none" "none"] (anchoring))
          "While following the end, anchoring is off, so its adjustments don't read as scrolling up")
      (sut/set-anchoring! false)
      (is (= ["" ""] (anchoring))
          "Away from the end, anchoring keeps the reader's place")
      (finally
        (set! (.-getElementById js/document) get-element-by-id)))))

(deftest scrolled-up?-test
  (testing "compares with where the target was last scrolled, by the user or the page"
    (is (true? (sut/scrolled-up? {:page 1000} :page 990)))
    (is (false? (sut/scrolled-up? {:page 1000} :page 1000)))
    (is (false? (sut/scrolled-up? {:page 1000} :page 1200))))
  (testing "doesn't count the first scroll of a target as going up"
    (is (false? (sut/scrolled-up? {} :scroller 10)))))

(deftest after-scroll-test
  (testing "turns auto scrolling off when the user scrolls up from the end of the output"
    (is (false? (sut/after-scroll true {:up? true :end-visible? false}))))
  (testing "keeps auto scrolling on while the end of the output is in view, also when the scroll went up, as when the view grows"
    (is (true? (sut/after-scroll true {:up? true :end-visible? true}))))
  (testing "turns auto scrolling on when a scroll brings the end of the output into view"
    (is (true? (sut/after-scroll false {:up? false :end-visible? true}))))
  (testing "leaves auto scrolling as it was on a scroll down that doesn't reach the end"
    (is (false? (sut/after-scroll false {:up? false :end-visible? false})))
    (is (true? (sut/after-scroll true {:up? false :end-visible? false})))))
