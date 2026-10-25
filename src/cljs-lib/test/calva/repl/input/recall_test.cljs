(ns calva.repl.input.recall-test
  (:require
   [calva.repl.input.evaluate :as evaluate]
   [calva.repl.input.host :as host]
   [calva.repl.input.host-fixtures :refer [last-context-line mount-focused! post! posted-named with-fresh-host with-view]]
   [cljs.test :refer-macros [async deftest testing is]]))

(defn- posted-histories [posted]
  (mapv #(mapv :repl-input.history/code (:repl-input.history/entries %)) (posted-named posted "repl-input-history")))

(defn- evaluate! [evaluations]
  (let [evaluated (evaluate/evaluate-focused!)]
    ((:resolve (last @evaluations)) #js {:succeeded true})
    evaluated))

(deftest history-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted evaluations] :as host}]
        (with-view host
          (fn []
            (mount-focused! "output-view" "(def a 1)")
            (testing "gives a mounted REPL Input the history to walk"
              (is (= [[]] (posted-histories posted))))
            (-> (evaluate! evaluations)
                (.then (fn [_]
                         (testing "adds the evaluated code with its context, and gives the REPL Input the new history"
                           (is (= [["(def a 1)" "user"]]
                                  (mapv (juxt :repl-input.history/code :repl-input.context/ns)
                                        (:repl-input.history/entries @host/!state))))
                           (is (= [[] ["(def a 1)"]] (posted-histories posted))))
                         (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 3 :text "(def a 1)" :selections [[9 9]]})
                         (evaluate! evaluations)))
                (.then (fn [_]
                         (testing "gives the evaluating REPL Input the history again when a repeat leaves it as it was, to end its walk"
                           (is (= [[] ["(def a 1)"] ["(def a 1)"]] (posted-histories posted))))
                         (done))))))))))

(deftest per-session-history-test
  (with-fresh-host
    (fn [{:keys [posted] :as host}]
      (with-view host
        (fn []
          (swap! host/!state assoc
                 :repl-input.history/entries [{:repl-input.history/code "(def a 1)" :repl-input.context/ns "user" :repl-input.context/session-key "clj"}
                                              {:repl-input.history/code "(js/alert 1)" :repl-input.context/ns "user" :repl-input.context/session-key "cljs"}])
          (mount-focused! "output-view" "")
          (host/settings-changed! {"calva.outputViews.replInputHistoryPerSession" true})
          (testing "gives the REPL Inputs the entries of the context's session when the history is kept per session"
            (is (= [["(def a 1)" "(js/alert 1)"] ["(def a 1)"]] (posted-histories posted))))
          (host/editor-moved! #js {:ns "pirate.ui" :sessionKey "cljs"} #js {})
          (testing "and when the context's session changes"
            (is (= ["(js/alert 1)"] (last (posted-histories posted))))))))))

(deftest lock-test
  (with-fresh-host
    (fn [{:keys [posted] :as host}]
      (with-view host
        (fn []
          (mount-focused! "output-view" "(def a 1)")
          (post! {:command "repl-input-lock" :repl-input/id "output-view"
                  :lock {:repl-input.context/ns "pirate.core"
                         :repl-input.context/ns-form "(ns pirate.core)"
                         :repl-input.context/session-key "cljs"}})
          (testing "locks the namespace, ns form and session that a click on the mode button posts"
            (is (= {:repl-input.context/ns "pirate.core" :repl-input.context/session-key "cljs" :repl-input.context/locked? true}
                   (last-context-line posted)))
            (is (= "(ns pirate.core)" (:repl-input.context/ns-form (:repl-input.context/lock @host/!state))))))))))
