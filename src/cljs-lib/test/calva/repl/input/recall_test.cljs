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

(deftest lock-test
  (with-fresh-host
    (fn [{:keys [posted routes] :as host}]
      (with-view host
        (fn []
          (mount-focused! "output-view" "(def a 1)")
          (post! {:command "repl-input-lock" :repl-input/id "output-view"
                  :lock {:repl-input.context/ns "pirate.core"
                         :repl-input.context/ns-form "(ns pirate.core)"
                         :repl-input.context/source-file "file:///pirate/src/pirate/core.cljc"
                         :repl-input.context/session-key "cljs"}})
          (testing "locks the namespace, ns form and source file that recalling a history entry from another context posts, in the session that routing the source file gives"
            (is (= {:repl-input.context/ns "pirate.core" :repl-input.context/session-key "clj" :repl-input.context/locked? true}
                   (last-context-line posted)))
            (is (= {:repl-input.context/ns "pirate.core"
                    :repl-input.context/ns-form "(ns pirate.core)"
                    :repl-input.context/source-file "file:///pirate/src/pirate/core.cljc"}
                   (:repl-input.context/lock @host/!state))))
          (swap! routes assoc "file:///pirate/src/pirate/core.cljc" "cljs")
          (host/routing-changed!)
          (testing "routes the lock's source file again when routing changes, as the cljc target does"
            (is (= "cljs" (:repl-input.context/session-key (last-context-line posted)))))
          (post! {:command "repl-input-lock" :repl-input/id "output-view"
                  :lock {:repl-input.context/ns "pirate.ui"
                         :repl-input.context/ns-form "(ns pirate.ui)"
                         :repl-input.context/session-key "cljs:2"}})
          (testing "locks an entry without a source file in the session routing gives without a file"
            (is (= {:repl-input.context/ns "pirate.ui" :repl-input.context/session-key "clj" :repl-input.context/locked? true}
                   (last-context-line posted)))))))))

(defn- posted-session-keys [posted]
  (mapv #(mapv :repl-input.context/session-key (:repl-input.history/entries %)) (posted-named posted "repl-input-history")))

(deftest routed-history-test
  (with-fresh-host
    (fn [{:keys [posted routes] :as host}]
      (with-view host
        (fn []
          (swap! host/!state assoc
                 :repl-input.history/entries [{:repl-input.history/code "(def a 1)" :repl-input.context/ns "pirate.core" :repl-input.context/session-key "clj"
                                               :repl-input.context/source-file "file:///pirate/src/pirate/core.cljc"}
                                              {:repl-input.history/code "(js/alert 1)" :repl-input.context/ns "user" :repl-input.context/session-key "cljs:2"}])
          (mount-focused! "output-view" "")
          (testing "gives the REPL Inputs the entries in the sessions that routing their source files gives now, and without one, routing without a file"
            (is (= [["clj" "clj"]] (posted-session-keys posted))))
          (swap! routes assoc "file:///pirate/src/pirate/core.cljc" "cljs")
          (host/routing-changed!)
          (testing "gives them the entries again when routing changes"
            (is (= [["clj" "clj"] ["cljs" "clj"]] (posted-session-keys posted))))
          (host/routing-changed!)
          (testing "posts nothing when routing gives the entries the sessions they had"
            (is (= 2 (count (posted-session-keys posted)))))
          (testing "keeps the session keys the entries were evaluated in"
            (is (= ["clj" "cljs:2"] (mapv :repl-input.context/session-key (:repl-input.history/entries @host/!state))))))))))
