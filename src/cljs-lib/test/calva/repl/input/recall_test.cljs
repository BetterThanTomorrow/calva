(ns calva.repl.input.recall-test
  (:require
   [calva.repl.input.evaluate :as evaluate]
   [calva.repl.input.host :as host]
   [calva.repl.input.host-fixtures :refer [last-context-line mount-focused! post! posted-named with-fresh-host with-view]]
   [cljs.test :refer-macros [async deftest testing is]]))

(defn- last-edit [posted]
  (select-keys (last (posted-named posted "repl-input-edit")) [:repl-input/version :text :selections]))

(defn- walk! [direction]
  (post! {:command "repl-input-walk-history" :repl-input/id "output-view" :direction direction}))

(deftest history-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted evaluations] :as host}]
        (with-view host
          (fn []
            (mount-focused! "output-view" "(ns pirate.core)")
            (let [evaluated (evaluate/evaluate-focused!)
                  file-path (.-filePath ^js (:options (first @evaluations)))]
              ((:resolve (first @evaluations)) #js {:succeeded true})
              (-> evaluated
                  (.then (fn [_]
                           (testing "adds the evaluated code with the evaluation's id and context"
                             (is (= [["(ns pirate.core)" "user" file-path]]
                                    (mapv (fn [{:repl-input.history/keys [id code] :repl-input.context/keys [ns]}]
                                            [code ns (str "calva-repl-input/" id ".clj")])
                                          (:repl-input.history/entries @host/!state)))))
                           (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 3 :text "(draft" :selections [[6 6]]})
                           (walk! "back")
                           (testing "walks back to the entry, and locks the context it was evaluated in"
                             (is (= {:repl-input/version 3 :text "(ns pirate.core)" :selections [[16 16]]} (last-edit posted)))
                             (is (= {:repl-input.context/ns "user" :repl-input.context/session "clj" :repl-input.context/locked? true}
                                    (last-context-line posted))))
                           (walk! "back")
                           (testing "goes nowhere past the oldest entry"
                             (is (= 3 (:repl-input/version (last-edit posted)))))
                           (walk! "forward")
                           (testing "walking past the newest entry brings back the text and the lock from before"
                             (is (= {:repl-input/version 4 :text "(draft" :selections [[6 6]]} (last-edit posted)))
                             (is (= {:repl-input.context/ns "pirate.core" :repl-input.context/session "clj" :repl-input.context/locked? true}
                                    (last-context-line posted))))
                           (done)))))))))))
