(ns calva.repl.webview.viewport-observer-test
  (:require
   [calva.repl.webview.fake-document :as fake-document]
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

(deftest aria-hidden-updates-test
  (let [a #js {}
        b #js {}]
    (is (= [[a true] [b false]]
           (sut/aria-hidden-updates [(entry a false) (entry b true)]))
        "A block out of the observed range is hidden, a block in it is not")))

(deftest start-and-stop-test
  (let [output (output-with-blocks)
        [a b c] (array-seq (.-children output))]
    (try
      (sut/start! output)
      (let [^js blocks (:blocks (sut/observers))]
        (testing "start! observes every block, with a margin of a scroll height around the visible part"
          (is (= [a b c] (vec (.-observed blocks))))
          (is (= "100% 0px" (.. blocks -options -rootMargin))))
        (testing "the root is the document while the REPL Input is off"
          (is (identical? js/document (.. blocks -options -root))))
        (testing "every block is hidden until the observer finds it near the view"
          (is (= ["true" "true" "true"] (hidden-blocks output))))
        (testing "the observer's callback hides the blocks out of range"
          ((.-callback blocks) #js [(entry a false) (entry b true) (entry c true)])
          (is (= ["true" nil nil] (hidden-blocks output))))
        (testing "start! again disconnects the running observers"
          (sut/start! output)
          (is (.-disconnected blocks))
          (is (not (identical? blocks (:blocks (sut/observers)))))))
      (testing "stop! disconnects, and makes every block readable again"
        (let [{:keys [^js blocks ^js children ^js body]} (sut/observers)]
          (sut/stop! output)
          (is (every? #(.-disconnected ^js %) [blocks children body]))
          (is (= [nil nil nil] (hidden-blocks output)))
          (is (nil? (sut/observers)))))
      (finally
        (sut/stop! output)))))

(deftest new-and-removed-blocks-test
  (let [output (output-with-blocks)]
    (try
      (sut/start! output)
      (let [{:keys [^js blocks ^js children]} (sut/observers)
            added (fake-document/hiccup-element [:pre "d"])
            removed (first (array-seq (.-children output)))]
        ((.-callback children) #js [#js {:addedNodes #js [added] :removedNodes #js [removed]}])
        (is (some #(identical? added %) (.-observed blocks)) "A new block is observed")
        (is (= "true" (.getAttribute added "aria-hidden")) "A new block is hidden until it is found near the view")
        (is (not-any? #(identical? removed %) (.-observed blocks)) "A removed block is no longer observed"))
      (finally
        (sut/stop! output)))))

(deftest restart-when-the-scroll-root-changes-test
  (let [output (output-with-blocks)
        scroller (fake-document/hiccup-element [:div {:id "output-scroller"}])
        get-element-by-id (.-getElementById js/document)
        class-list (.. js/document -body -classList)]
    (set! (.-getElementById js/document) (fn [id] (when (= "output-scroller" id) scroller)))
    (try
      (sut/start! output)
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
            (is (= 3 (.. blocks -observed -length)) "Every block is observed again"))))
      (finally
        (sut/stop! output)
        (.remove class-list "word-wrap" "repl-input-on")
        (set! (.-getElementById js/document) get-element-by-id)))))
