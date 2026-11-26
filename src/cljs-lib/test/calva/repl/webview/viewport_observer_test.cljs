(ns calva.repl.webview.viewport-observer-test
  (:require
   [calva.repl.webview.fake-document :as fake-document]
   [calva.repl.webview.near-colors :as near-colors]
   [calva.repl.webview.viewport-observer :as sut]
   [cljs.test :refer-macros [deftest is testing]]))

(defn- output-with-blocks
  []
  (fake-document/hiccup-element [:div {:id "output"} [:pre "a"] [:pre "b"] [:pre "c"]]))

(defn- entry
  [target intersecting?]
  #js {:target target :isIntersecting intersecting?})

(defn- hidden-blocks
  [^js output]
  (mapv #(.getAttribute ^js % "aria-hidden") (.-children output)))

(defn- with-accessibility-support
  "Calls `f` with the body's accessibility support `on?`."
  [on? f]
  (.. js/document -body (setAttribute "data-accessibility-support" (if on? "on" "off")))
  (try
    (f)
    (finally
      (.. js/document -body (removeAttribute "data-accessibility-support")))))

(deftest near-updates-test
  (let [a #js {}
        b #js {}]
    (is (= [[a false] [b true]]
           (sut/near-updates [(entry a false) (entry b true)]))
        "A block out of the observed range is far, a block in it is near")))

(deftest root-margin-test
  (is (= "8500px 0px" (sut/root-margin 500 17)) "500 lines of 17 pixels above and below")
  (is (= "171px 0px" (sut/root-margin 10 17.1)) "Whole pixels"))

(deftest start-and-stop-test
  (let [output (output-with-blocks)
        [a b c] (array-seq (.-children output))]
    (with-accessibility-support true
      (fn []
        (try
          (sut/start! output "300px 0px")
          (let [^js blocks (:blocks (sut/observers))]
            (testing "start! observes every block, with the margin around the visible part"
              (is (= [a b c] (vec (.-observed blocks))))
              (is (= "300px 0px" (.. blocks -options -rootMargin))))
            (testing "the root is the document while the REPL Input is off"
              (is (identical? js/document (.. blocks -options -root))))
            (testing "every block is hidden until the observer finds it near the view"
              (is (= ["true" "true" "true"] (hidden-blocks output))))
            (testing "the observer's callback hides the blocks out of range"
              ((.-callback blocks) #js [(entry a false) (entry b true) (entry c true)])
              (is (= ["true" nil nil] (hidden-blocks output))))
            (testing "start! again disconnects the running observers"
              (sut/start! output "300px 0px")
              (is (.-disconnected blocks))
              (is (not (identical? blocks (:blocks (sut/observers)))))))
          (testing "stop! disconnects, and makes every block readable again"
            (let [{:keys [^js blocks ^js children ^js body]} (sut/observers)]
              (sut/stop! output)
              (is (every? #(.-disconnected ^js %) [blocks children body]))
              (is (= [nil nil nil] (hidden-blocks output)))
              (is (nil? (sut/observers)))))
          (finally
            (sut/stop! output)))))))

(deftest without-accessibility-support-test
  (let [output (output-with-blocks)
        [a b c] (array-seq (.-children output))]
    (with-accessibility-support false
      (fn []
        (try
          (sut/start! output "300px 0px")
          (let [^js blocks (:blocks (sut/observers))]
            (is (= [a b c] (vec (.-observed blocks))) "Every block is observed")
            (is (= [nil nil nil] (hidden-blocks output)) "and none is hidden")
            ((.-callback blocks) #js [(entry a false) (entry b true) (entry c true)])
            (is (= [nil nil nil] (hidden-blocks output)) "A far block stays readable")
            (is (= [false true true] (mapv near-colors/near? [a b c])) "The page knows which blocks are near"))
          (finally
            (sut/stop! output)))))))

(deftest new-and-removed-blocks-test
  (let [output (output-with-blocks)]
    (with-accessibility-support true
      (fn []
        (try
          (sut/start! output "300px 0px")
          (let [{:keys [^js blocks ^js children]} (sut/observers)
                added (fake-document/hiccup-element [:pre "d"])
                removed (first (array-seq (.-children output)))]
            ((.-callback children) #js [#js {:addedNodes #js [added] :removedNodes #js [removed]}])
            (is (some #(identical? added %) (.-observed blocks)) "A new block is observed")
            (is (= "true" (.getAttribute added "aria-hidden")) "A new block is hidden until it is found near the view")
            (is (not-any? #(identical? removed %) (.-observed blocks)) "A removed block is no longer observed"))
          (finally
            (sut/stop! output)))))))

(deftest restart-when-the-scroll-root-changes-test
  (let [output (output-with-blocks)
        scroller (fake-document/hiccup-element [:div {:id "output-scroller"}])
        get-element-by-id (.-getElementById js/document)
        class-list (.. js/document -body -classList)]
    (set! (.-getElementById js/document) (fn [id] (when (= "output-scroller" id) scroller)))
    (try
      (sut/start! output "300px 0px")
      (let [{^js first-blocks :blocks ^js body :body} (sut/observers)]
        (testing "a body class change that keeps the root keeps the observers"
          (.add class-list "word-wrap")
          ((.-callback body) #js [])
          (is (identical? first-blocks (:blocks (sut/observers)))))
        (testing "the REPL Input coming makes the observers again, rooted in the output's own scroller"
          (.add class-list "repl-input-on")
          ((.-callback body) #js [])
          (let [^js blocks (:blocks (sut/observers))]
            (is (.-disconnected first-blocks))
            (is (identical? scroller (.. blocks -options -root)))
            (is (= 3 (.. blocks -observed -length)) "Every block is observed again")
            (is (= "300px 0px" (.. blocks -options -rootMargin)) "With the same margin"))))
      (finally
        (sut/stop! output)
        (.remove class-list "word-wrap" "repl-input-on")
        (set! (.-getElementById js/document) get-element-by-id)))))
