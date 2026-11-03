(ns calva.repl.webview.folded-result-test
  (:require
   [calva.repl.webview.app-db :as app-db]
   [calva.repl.webview.fake-document :as fake-document]
   [calva.repl.webview.folded-result :as folded-result]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest is testing use-fixtures]]
   [clojure.string :as string]))

(defn- reset-page-state!
  []
  (reset! @#'ui/!context nil)
  (folded-result/clear!))

(use-fixtures :each (fn [f]
                      (reset-page-state!)
                      (try
                        (with-redefs [ui/insert-hiccup! fake-document/insert-hiccup!] (f))
                        (finally
                          (reset-page-state!)))))

(def ^:private large-result
  (str "[" (string/join "\n " (map #(str "{:id " % " :name \"item-" % "\"}") (range 300))) "]"))

(defn- result-fxs
  [output category]
  (:uf/fxs (app-db/handle-action app-db/initial-db [:msg/output {:command/name "show-result"
                                                                 :output-category category
                                                                 :output output}])))

(deftest large-results-are-folded-test
  (testing "a large evaluation result is appended folded"
    (is (= [[:fx/append-folded-result large-result]] (result-fxs large-result "evalResults"))))
  (testing "a small result is appended as before"
    (is (= [[:fx/append-result "42" nil nil]] (result-fxs "42" "evalResults"))))
  (testing "other Clojure output, like clojuredocs examples, isn't folded"
    (is (= :fx/append-result (ffirst (result-fxs large-result "clojure")))))
  (testing "a large result with an image goes where images go, unfolded"
    (let [output (str "\"data:image/png;base64," (apply str (repeat 6000 "A")) "\"")]
      (is (= :fx/append-result-with-images (ffirst (result-fxs output "evalResults")))))))

(deftest folded-result-actions-test
  (is (= [[:fx/unfold-result :button] [:fx/trim-output]]
         (:uf/fxs (app-db/handle-action app-db/initial-db [:output/ax.unfold-result :button])))
      "Unfolding trims the output right away, since it can grow the page past the cap")
  (is (= [[:fx/copy-folded-result :button]]
         (:uf/fxs (app-db/handle-action app-db/initial-db [:output/ax.copy-folded-result :button])))))

(defn- folded-output
  []
  (let [output (fake-document/hiccup-element [:div {:id "output"}])]
    (reset! @#'ui/!context {:ns "my.ns" :session-key "clj"})
    (ui/exec-effect! output [:fx/append-folded-result large-result])
    output))

(deftest folded-result-element-test
  (let [^js block (first (.-children (folded-output)))]
    (is (= "folded-result" (.getAttribute block "data-output-element-type")))
    (is (= "Unfold result" (.getAttribute (.querySelector block "button.output-unfold") "aria-label")))
    (is (= "[{:id 0 :name \"item-0\"}" (.-textContent (.querySelector block ".output-folded-start"))) "The start of the first line")
    (is (nil? (.querySelector block "code")) "The start isn't printed code, so a click doesn't open printed code's editor on it")
    (is (= (str (.toLocaleString (count large-result) "en-US") " characters, 300 lines")
           (.-textContent (.querySelector block ".output-folded-size"))))
    (is (< (count (.-textContent block)) 100) "The output cap counts the part a folded result shows")))

(deftest copy-folded-result-test
  (let [^js block (first (.-children (folded-output)))
        copied (atom nil)
        clipboard (.-clipboard js/navigator)]
    (set! (.-clipboard js/navigator) #js {:writeText (fn [text] (reset! copied text) (js/Promise.resolve))})
    (try
      (ui/exec-effect! nil [:fx/copy-folded-result (.querySelector block "button.output-code-copy")])
      (is (= large-result @copied) "Copy copies the whole result")
      (finally
        (set! (.-clipboard js/navigator) clipboard)))))

(defn- unfold!
  [^js output ^js block]
  (with-redefs [ui/post-to-host! (constantly nil)]
    (ui/exec-effect! output [:fx/unfold-result (.querySelector block "button.output-unfold")])))

(deftest unfold-result-test
  (let [output (folded-output)
        ^js block (first (.-children output))
        posted (atom [])]
    (reset! @#'ui/!context {:ns "other.ns" :session-key "cljs"})
    (with-redefs [ui/post-to-host! #(swap! posted conj %)]
      (ui/exec-effect! output [:fx/unfold-result (.querySelector block "button.output-unfold")]))
    (let [^js unfolded (first (.-children output))
          ^js code (.querySelector unfolded "code")]
      (is (= 1 (.. output -children -length)))
      (is (= large-result (.-textContent code)) "The result is drawn whole in its place")
      (is (= ["my.ns" "clj"] [(.. code -dataset -ns) (.. code -dataset -sessionKey)])
          "Its code gets the namespace and session it was printed in, not the latest ones")
      (is (= ["output-highlight"] (mapv :command @posted)) "Its colors are asked for")
      (is (empty? @@#'folded-result/!folded) "Its kept text is dropped")
      (testing "the output cap keeps the result unfolded last"
        (let [^js newer (fake-document/hiccup-element [:pre "n"])]
          (.appendChild output newer)
          (ui/trim-output! output 1)
          (is (= [unfolded newer] (vec (.-children output)))))))))

(deftest unfolding-another-result-releases-the-first-test
  (let [output (fake-document/hiccup-element [:div {:id "output"}])]
    (ui/exec-effect! output [:fx/append-folded-result large-result])
    (ui/exec-effect! output [:fx/append-folded-result large-result])
    (let [[first-block second-block] (vec (.-children output))]
      (unfold! output first-block)
      (let [first-unfolded (first (.-children output))]
        (unfold! output second-block)
        (ui/trim-output! output 1)
        (is (not-any? #(identical? first-unfolded %) (.-children output))
            "Only the result unfolded last is kept from the output cap")))))

(deftest folded-text-is-dropped-with-its-block-test
  (testing "by the output cap"
    (let [output (folded-output)]
      (.appendChild output (fake-document/hiccup-element [:pre "newer"]))
      (ui/trim-output! output 1)
      (is (empty? @@#'folded-result/!folded))))
  (testing "by clear"
    (let [output (folded-output)]
      (ui/clear-output-dom output)
      (is (empty? @@#'folded-result/!folded)))))

(deftest a-kept-unfolded-result-doesnt-start-a-stdout-run-test
  (let [output (folded-output)]
    (unfold! output (first (.-children output)))
    (doseq [hiccup [[:pre {:class "output-stdout" :data-output-element-type "evalOut"} "aaaa"]
                    [:pre {:class "output-stdout" :data-output-element-type "evalOut" :data-continues "true"} "bbbb"]
                    [:pre {:class "output-stdout" :data-output-element-type "evalOut" :data-continues "true"} "cccc"]]]
      (.appendChild output (fake-document/hiccup-element hiccup)))
    (ui/trim-output! output 8)
    (let [[_unfolded ^js oldest-kept ^js newest] (vec (.-children output))]
      (is (= "bbbb" (.-textContent oldest-kept)))
      (is (not (.hasAttribute oldest-kept "data-continues")) "The oldest stdout block kept starts its run")
      (is (.hasAttribute newest "data-continues")))))
