(ns calva.repl.input.host-stdin-test
  (:require
   [calva.repl.input.host-fixtures :refer [mount-focused! post! posted-named with-fresh-host with-view]]
   [calva.repl.input.stdin :as sut]
   [cljs.test :refer-macros [async deftest testing is]]))

(defn- bars [posted]
  (mapv :repl-input/evaluation (posted-named posted "repl-input-evaluation")))

(deftest read-line+-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted contexts] :as host}]
        (with-view host
          (fn []
            (let [shown (atom 0)]
              (with-redefs [sut/show-sidebar! #(swap! shown inc)]
                (mount-focused! "output-sidebar" "")
                (let [line+ (sut/read-line+ #js {:value (js/Promise. (fn [_ _]))})]
                  (testing "reveals the Output Sidebar and waits there for the line"
                    (is (= 1 @shown))
                    (is (= :reading-stdin (last (bars posted))))
                    (is (not-any? #(= "calva:replInputReadingStdin" (first %)) @contexts)))
                  (post! {:command "repl-input-send-line" :repl-input/id "output-sidebar" :line "Ahoy"})
                  (-> line+
                      (.then (fn [line]
                               (testing "answers with the line sent from the stdin input, and stops waiting"
                                 (is (= "Ahoy" line))
                                 (is (nil? (last (bars posted)))))
                               (done)))))))))))))

(deftest read-line+-evaluation-ends-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted] :as host}]
        (with-view host
          (fn []
            (with-redefs [sut/show-sidebar! (constantly nil)]
              (mount-focused! "output-sidebar" "")
              (let [!end (atom nil)
                    value (js/Promise. (fn [_ reject] (reset! !end reject)))]
                (sut/read-line+ #js {:value value})
                (@!end (js/Error. "Interrupted"))
                (-> value
                    (.catch (constantly nil))
                    (.then (fn [_]
                             (testing "stops waiting when the evaluation ends without a line"
                               (is (nil? (last (bars posted)))))
                             (done))))))))))))
