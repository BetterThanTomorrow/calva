(ns calva.repl.input.host-evaluation-test
  (:require
   [calva.repl.input.evaluate :as sut]
   [calva.repl.input.host :as input-host]
   [calva.repl.input.host-fixtures :refer [last-context-line mount-focused! post! posted-named with-fresh-host with-view]]
   [calva.repl.input.reveal :as reveal]
   [cljs.test :refer-macros [async deftest testing is]]))

(deftest evaluate-focused!-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted evaluations] :as host}]
        (with-view host
          (fn []
            (mount-focused! "output-view" "(ns pirate.core)")
            (let [evaluated (sut/evaluate-focused!)
                  {:keys [^js options resolve]} (first @evaluations)]
              (testing "evaluates the text in the context, with a file of its own"
                (is (= ["(ns pirate.core)" "user" "(in-ns 'user)" "clj"]
                       [(.-code options) (.-ns options) (.-nsForm options) (.-sessionKey options)]))
                (is (re-matches #"calva-repl-input/\d+\.clj" (.-filePath options))))
              (testing "clears the REPL Input"
                (is (= [{:command/name "repl-input-edit" :repl-input/id "output-view" :repl-input/version 1 :text "" :selections [[0 0]]}]
                       (posted-named posted "repl-input-edit"))))
              (testing "shows that the evaluation runs"
                (is (= :running (:repl-input/evaluation (last (posted-named posted "repl-input-evaluation"))))))
              (resolve #js {:succeeded true})
              (-> evaluated
                  (.then (fn [_]
                           (testing "locks the namespace of a successfully evaluated ns form"
                             (is (= {:repl-input.context/ns "pirate.core" :repl-input.context/session "clj" :repl-input.context/locked? true}
                                    (last-context-line posted))))
                           (testing "shows that no evaluation runs"
                             (is (nil? (:repl-input/evaluation (last (posted-named posted "repl-input-evaluation"))))))
                           (post! {:command "repl-input-follow-editor" :repl-input/id "output-view"})
                           (testing "follows the editor again on click"
                             (is (= {:repl-input.context/ns "user" :repl-input.context/session "clj" :repl-input.context/locked? false}
                                    (last-context-line posted))))
                           (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 3 :text "(ns pirate.ui)" :selections [[0 0]]})
                           (let [evaluated (sut/evaluate-focused!)]
                             ((:resolve (second @evaluations)) #js {:succeeded false})
                             evaluated)))
                  (.then (fn [_]
                           (testing "keeps following the editor when the evaluation fails"
                             (is (false? (:repl-input.context/locked? (last-context-line posted)))))
                           (done)))))))))))

(deftest evaluate-focused!-evaluation-id-test
  (with-fresh-host
    (fn [{:keys [evaluations] :as host}]
      (with-view host
        (fn []
          (mount-focused! "output-view" "(def a 1)")
          (sut/evaluate-focused!)
          (let [{:keys [^js options]} (first @evaluations)]
            (testing "gives the evaluation's id for its echoed code block, the id in its file name"
              (is (number? (.-evaluationId options)))
              (is (= (str "calva-repl-input/" (.-evaluationId options) ".clj") (.-filePath options))))))))))

(deftest evaluate-focused!-not-connected-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted evaluations session-keys] :as host}]
        (with-view host
          (fn []
            (reset! session-keys [])
            (mount-focused! "output-view" "(+ 1 2)")
            (-> (sut/evaluate-focused!)
                (.then (fn [_]
                         (testing "evaluates nothing and keeps the text when no session answers"
                           (is (= [] @evaluations))
                           (is (= [] (posted-named posted "repl-input-edit"))))
                         (done))))))))))

(defn- evaluation-options [{:keys [^js options]}]
  {:code (.-code options) :line (.-line options) :column (.-column options) :send-code (.-sendCode options)
   :ns (.-ns options) :ns-form (.-nsForm options) :session-key (.-sessionKey options)})

(defn- history-codes []
  (mapv :repl-input.history/code (:repl-input.history/entries @input-host/!state)))

(defn- picking [result]
  (fn [_doc _context] result))

(defn- after-pick []
  (js/Promise.resolve nil))

(deftest evaluate-form-focused!-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted evaluations] :as host}]
        (with-view host
          (fn []
            (mount-focused! "output-view" "(def a 1)\n(def b 2)")
            (sut/evaluate-form-focused! (picking #js {:code "(def b 2)" :line 1 :column 0}))
            (-> (after-pick)
                (.then (fn [_]
                         (testing "evaluates the form the pick takes, where it starts"
                           (is (= ["(def b 2)" 1 0]
                                  (let [^js options (:options (last @evaluations))]
                                    [(.-code options) (.-line options) (.-column options)]))))
                         (testing "adds the form to the history"
                           (is (= ["(def b 2)"] (history-codes))))
                         (testing "keeps the text when the form wasn't all of it"
                           (is (= [] (posted-named posted "repl-input-edit"))))
                         ((:resolve (last @evaluations)) #js {:succeeded true})
                         (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 2 :text "\n(def c 3) " :selections [[1 1]]})
                         (sut/evaluate-form-focused! (picking #js {:code "(def c 3)" :line 1 :column 0}))
                         (after-pick)))
                (.then (fn [_]
                         (testing "clears the REPL Input when the form was all of the text"
                           (is (= [""] (mapv :text (posted-named posted "repl-input-edit")))))
                         (testing "adds that form to the history too"
                           (is (= ["(def b 2)" "(def c 3)"] (history-codes))))
                         (done))))))))))

(deftest history-test
  (async done
    (with-fresh-host
      (fn [{:keys [evaluations] :as host}]
        (with-view host
          (fn []
            (mount-focused! "output-view" "(def a 1)\n(def b 2)")
            (sut/evaluate-focused!)
            (testing "evaluating all of the text adds all of it to the history"
              (is (= ["(def a 1)\n(def b 2)"] (history-codes))))
            (sut/evaluate-from-focused! (picking #js {:code "(def b 2)" :line 1 :column 0}))
            (-> (after-pick)
                (.then (fn [_]
                         (testing "the other evaluation commands add nothing to the history"
                           (is (= 2 (count @evaluations)))
                           (is (= ["(def a 1)\n(def b 2)"] (history-codes))))
                         (done))))))))))

(deftest kept-code-test
  (async done
    (with-fresh-host
      (fn [{:keys [evaluations] :as host}]
        (with-view host
          (fn []
            (mount-focused! "output-view" "(a (b c) d)")
            (sut/evaluate-from-focused! (picking #js {:code "(defn f [])" :line 2 :column 3}))
            (-> (after-pick)
                (.then (fn [_]
                         (let [id (.-evaluationId ^js (:options (last @evaluations)))]
                           (testing "keeps the code of an evaluation without a history entry by its id"
                             (is (= "(defn f [])" (reveal/evaluation-code (str "/" id ".clj")))))
                           (testing "finds the definition in it where the REPL reports it"
                             (is (= {:uri (str "calva-repl-input:/" id ".clj") :line 0 :character 0}
                                    (js->clj (reveal/evaluation-location id 3 4) :keywordize-keys true)))))
                         (done))))))))))

(deftest evaluate-from-focused!-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted evaluations] :as host}]
        (with-view host
          (fn []
            (mount-focused! "output-view" "(a (b c) d)")
            (let [picked (atom [])
                  pick (fn [result]
                         (fn [^js doc ^js context]
                           (swap! picked conj [(.-text doc) (.-ns context) (.-nsForm context) (.-sessionKey context)])
                           result))
                  after-pick (fn [] (js/Promise.resolve nil))]
              (sut/evaluate-from-focused! (pick #js {:code "(b c)" :line 0 :column 3}))
              (-> (after-pick)
                  (.then (fn [_]
                           (testing "hands the pick the REPL Input's text and the context"
                             (is (= [["(a (b c) d)" "user" "(in-ns 'user)" "clj"]] @picked)))
                           (testing "evaluates the picked code in the context, where it starts, and keeps the text"
                             (is (= {:code "(b c)" :line 0 :column 3 :send-code true
                                     :ns "user" :ns-form "(in-ns 'user)" :session-key "clj"}
                                    (evaluation-options (last @evaluations))))
                             (is (= [] (posted-named posted "repl-input-edit"))))
                           ((:resolve (last @evaluations)) #js {:succeeded true})
                           (sut/evaluate-from-focused! (pick #js {:code "(x)" :line 0 :column 0 :sendCode false
                                                                  :ns "pirate.util" :nsForm "(in-ns 'pirate.util)" :sessionKey "cljs"}))
                           (after-pick)))
                  (.then (fn [_]
                           (testing "evaluates in the namespace and session the pick names, without sending the code when it says so"
                             (is (= {:code "(x)" :line 0 :column 0 :send-code false
                                     :ns "pirate.util" :ns-form "(in-ns 'pirate.util)" :session-key "cljs"}
                                    (evaluation-options (last @evaluations)))))
                           ((:resolve (last @evaluations)) #js {:succeeded true})
                           (js/Promise.all #js [(sut/evaluate-from-focused! (pick #js {:code "(x)" :sessionKey "cljs:2"}))
                                                (sut/evaluate-from-focused! (pick nil))])))
                  (.then (fn [_]
                           (testing "evaluates nothing when the pick's session isn't connected, or the pick takes nothing"
                             (is (= 2 (count @evaluations))))
                           (done)))))))))))

(deftest stdin-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted evaluations contexts] :as host}]
        (with-view host
          (fn []
            (mount-focused! "output-view" "(read-line)")
            (sut/evaluate-from-focused! (picking #js {:code "(read-line)" :line 0 :column 0}))
            (-> (after-pick)
                (.then (fn [_]
                         (let [^js options (:options (first @evaluations))
                               line (.stdin options)]
                           (testing "shows that the evaluation reads stdin"
                             (is (= :reading-stdin (:repl-input/evaluation (last (posted-named posted "repl-input-evaluation"))))))
                           (post! {:command "repl-input-send-line" :repl-input/id "output-view" :line "Ahoy"})
                           line)))
                (.then (fn [sent]
                         (testing "sends the line from the stdin input"
                           (is (= "Ahoy" sent)))
                         (testing "keeps the REPL Input's text"
                           (is (= [] (posted-named posted "repl-input-edit"))))
                         (testing "shows that the evaluation runs again"
                           (is (= :running (:repl-input/evaluation (last (posted-named posted "repl-input-evaluation"))))))
                         (testing "leaves the REPL Input's own keys alone"
                           (is (not-any? #(= "calva:replInputReadingStdin" (first %)) @contexts)))
                         (done))))))))))

(deftest interrupt-test
  (with-fresh-host
    (fn [{:keys [evaluations] :as host}]
      (with-view host
        (fn []
          (mount-focused! "output-view" "(Thread/sleep 10000)")
          (sut/evaluate-focused!)
          (let [interrupted (atom [])]
            ((.-onSent ^js (:options (first @evaluations)))
             #js {:id "7"
                  :running false
                  :interrupt #(swap! interrupted conj :evaluation)
                  :session #js {:interrupt (fn [id]
                                             (swap! interrupted conj [:session id])
                                             (js/Promise.resolve))}})
            (post! {:command "repl-input-interrupt" :repl-input/id "output-sidebar"})
            (testing "leaves the evaluations of the other view's REPL Input running"
              (is (= [] @interrupted)))
            (post! {:command "repl-input-interrupt" :repl-input/id "output-view"})
            (testing "interrupts an evaluation that has had no reply yet through its session"
              (is (= [[:session "7"]] @interrupted))))
          (mount-focused! "output-view" "(Thread/sleep 10000)")
          (sut/evaluate-focused!)
          (let [interrupted (atom [])]
            ((.-onSent ^js (:options (second @evaluations)))
             #js {:running true
                  :interrupt #(swap! interrupted conj :evaluation)})
            (sut/interrupt-focused!)
            (testing "interrupts the focused REPL Input's running evaluation"
              (is (= [:evaluation] @interrupted)))))))))
