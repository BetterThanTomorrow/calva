(ns calva.repl.webview.output-cap-test
  (:require
   [calva.repl.webview.auto-scroll :as auto-scroll]
   [calva.repl.webview.fake-document :as fake-document]
   [calva.repl.webview.printed-code.editor :as printed-code-editor]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest is testing use-fixtures]]))

(use-fixtures :each (fn [f] (with-redefs [ui/insert-hiccup! fake-document/insert-hiccup!] (f))))

(deftest kept-block-count-test
  (testing "keeps the newest blocks whose text fits the cap"
    (is (= 2 (ui/kept-block-count [30 40 50] 80)))
    (is (= 3 (ui/kept-block-count [30 40 10] 80))))
  (testing "always keeps the newest block, also when it alone is over the cap"
    (is (= 1 (ui/kept-block-count [500 40] 80))))
  (testing "reads only as many lengths as it needs"
    (is (= 2 (ui/kept-block-count (concat [30 40 50] (repeatedly #(throw (js/Error. "Read too far")))) 80)))))

(defn- block-texts
  [^js output]
  (mapv #(.-textContent ^js %) (.-children output)))

(deftest trim-output-test
  (testing "removes the oldest blocks while the output is over the cap"
    (let [output (fake-document/hiccup-element [:div {:id "output"} [:pre "aaaa"] [:pre "bbbb"] [:pre "cc"]])]
      (ui/trim-output! output 6)
      (is (= ["bbbb" "cc"] (block-texts output)))))
  (testing "keeps the newest block when it alone is over the cap"
    (let [output (fake-document/hiccup-element [:div {:id "output"} [:pre "aa"] [:pre "bbbbbbbb"]])]
      (ui/trim-output! output 6)
      (is (= ["bbbbbbbb"] (block-texts output)))))
  (testing "the first block left of a stdout run starts the run"
    (let [output (fake-document/hiccup-element [:div {:id "output"}
                                                [:pre {:class "output-stdout"} "aaaa"]
                                                [:pre {:class "output-stdout" :data-continues "true"} "bbbb"]])]
      (ui/trim-output! output 4)
      (is (not (.hasAttribute (first (.-children output)) "data-continues")))))
  (testing "the errors of removed blocks are dropped from the db"
    (let [output (fake-document/hiccup-element [:div {:id "output"}
                                                [:div {:data-error-id "e1"} "boom"]
                                                [:pre "aaaa"]])
          dispatched (atom [])]
      (with-redefs [ui/dispatch! #(swap! dispatched conj %)]
        (ui/trim-output! output 4))
      (is (= [[:output/ax.errors-removed {:error/ids ["e1"]}]] @dispatched))))
  (testing "nothing happens under the cap"
    (let [output (fake-document/hiccup-element [:div {:id "output"} [:pre "aa"] [:pre "bb"]])
          dispatched (atom [])]
      (with-redefs [ui/dispatch! #(swap! dispatched conj %)]
        (ui/trim-output! output 6))
      (is (= ["aa" "bb"] (block-texts output)))
      (is (empty? @dispatched)))))

(deftest trim-output-moves-the-focus-out-of-removed-blocks-test
  (let [output (fake-document/hiccup-element [:div {:id "output"}
                                              [:pre [:button {:class "output-copy-button"}] "aaaa"]
                                              [:pre "bbbb"]])
        focused (atom nil)
        scroller (doto (fake-document/hiccup-element [:div {:id "output-scroller"}])
                   (aset "focus" (fn [options] (reset! focused (.-preventScroll options)))))
        get-element-by-id (.-getElementById js/document)]
    (set! (.-getElementById js/document) (fn [id] (when (= "output-scroller" id) scroller)))
    (set! (.-activeElement js/document) (.querySelector (first (.-children output)) "button"))
    (try
      (with-redefs [auto-scroll/follow! (constantly nil)]
        (ui/trim-output! output 4))
      (is (true? @focused) "The output's scroller takes the focus, without scrolling, so the keys that scroll still do")
      (finally
        (set! (.-activeElement js/document) nil)
        (set! (.-getElementById js/document) get-element-by-id)))))

(deftest trim-output-forgets-the-page-state-of-removed-blocks-test
  (let [output (fake-document/hiccup-element [:div {:id "output"}
                                              [:pre [:code {:data-code-id "1"} "aaaa"] [:img {:class "gone"}]]
                                              [:pre [:code {:data-code-id "2"} "bbbb"]]])
        [removed kept] (array-seq (.-children output))
        removed-img (.querySelector removed "img")
        kept-img (fake-document/hiccup-element [:img])
        unmounted-in (atom nil)]
    (reset! @#'ui/!grammar-colors {"1" {:ranges []} "2" {:ranges []}})
    (reset! @#'ui/!semantic-keys {"1" "1@1" "2" "2@2"})
    (reset! @#'ui/!semantic-requests {:codes [["1@1" "aaaa" "user" "clj"] ["2@2" "bbbb" "user" "clj"]] :timer nil})
    (reset! @#'ui/!lazy-raw-entries [[removed "raw a"] [kept "raw b"]])
    (reset! @#'ui/!pending-local-images [{:img removed-img} {:img kept-img}])
    (reset! @#'ui/!local-image-lookups {"x" {:src "a.png" :waiters [[removed-img nil] [kept-img nil]]}})
    (try
      (with-redefs [printed-code-editor/unmount-in! (fn [_ elements] (reset! unmounted-in (vec elements)))]
        (ui/trim-output! output 4))
      (is (= #{"2"} (set (keys @@#'ui/!grammar-colors))))
      (is (= #{"2"} (set (keys @@#'ui/!semantic-keys))))
      (is (= ["2@2"] (mapv first (:codes @@#'ui/!semantic-requests))))
      (is (= [kept] (mapv first @@#'ui/!lazy-raw-entries)))
      (is (= [kept-img] (mapv :img @@#'ui/!pending-local-images)))
      (is (= [kept-img] (mapv first (get-in @@#'ui/!local-image-lookups ["x" :waiters]))))
      (is (= [removed] @unmounted-in) "Printed code's editor is unmounted when it is in a removed block")
      (finally
        (reset! @#'ui/!grammar-colors {})
        (reset! @#'ui/!semantic-keys {})
        (reset! @#'ui/!semantic-requests {:codes [] :timer nil})
        (reset! @#'ui/!lazy-raw-entries [])
        (reset! @#'ui/!pending-local-images [])
        (reset! @#'ui/!local-image-lookups {})))))

(deftest stdout-text-edge-cases-test
  (testing "a cut at the limit doesn't split a surrogate pair"
    (let [text (str (apply str (repeat 9999 "y")) "😀" "zz")
          [_ first-block] (ui/stdout-chunks text 0)]
      (is (= 9999 (count first-block)) "The pair goes to the next block whole")))
  (testing "stdout appended to a block goes into its last text node"
    (let [output (fake-document/hiccup-element [:div {:id "output"}])]
      (ui/append-stdout output "a\n" "evalOut")
      (ui/append-stdout output "b\n" "evalOut")
      (let [^js block (first (.-children output))]
        (is (= 2 (.. block -children -length)) "The Copy output button and one text node")
        (is (= "a\nb\n" (.-textContent block)))))))

(deftest throttle-fn-test
  (let [calls (atom [])
        timers (atom [])
        original-timeout js/setTimeout]
    (set! js/setTimeout (fn [f _] (swap! timers conj f) (count @timers)))
    (try
      (let [throttled (ui/throttle-fn #(swap! calls conj %) 250)]
        (throttled :a)
        (throttled :b)
        (throttled :c)
        (is (= [:a] @calls) "The first call goes through at once, the ones during the wait wait")
        ((last @timers))
        (is (= [:a :c] @calls) "When the wait ends, one call is made, with the latest arguments")
        (throttled :d)
        (is (= [:a :c] @calls) "The trailing call started a new wait")
        ((last @timers))
        (is (= [:a :c :d] @calls)))
      (finally
        (set! js/setTimeout original-timeout)))))

(deftest auto-scroll-stays-on-when-blocks-leave-the-top-test
  (is (true? (auto-scroll/after-scroll true {:up? true :end-visible? true}))
      "Blocks leaving the top lower the scroll position, which reads as a scroll up, but the end is still in view"))
