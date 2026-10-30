(ns calva.repl.webview.input.context-test
  (:require
   [calva.repl.webview.input.context :as sut]
   [cljs.test :refer-macros [deftest testing is]]
   [clojure.walk :as walk]))

(def ^:private following-line
  {:repl-input.context/ns "user"
   :repl-input.context/ns-form "(in-ns 'user)"
   :repl-input.context/session-key "clj"
   :repl-input.context/locked? false
   :repl-input.context/editor-ns "user"})

(def ^:private pirate-lock
  {:repl-input.context/ns "pirate.ui"
   :repl-input.context/ns-form "(ns pirate.ui)"
   :repl-input.context/session-key "cljs"})

(deftest indicator-test
  (testing "follows the editor, with the followed namespace"
    (is (= {:repl-input.indicator/mode :following :repl-input.indicator/ns "user"}
           (sut/indicator following-line nil))))
  (testing "is locked, with the locked namespace"
    (is (= {:repl-input.indicator/mode :locked :repl-input.indicator/ns "pirate.ui"}
           (sut/indicator (assoc pirate-lock :repl-input.context/locked? true :repl-input.context/editor-ns "user") nil))))
  (testing "is a selector while locked by a recalled history entry, between the entry's namespace and the editor's, in the same session"
    (is (= {:repl-input.indicator/mode :selector
            :repl-input.indicator/ns "pirate.ui"
            :repl-input.indicator/choices [{:repl-input.choice/mode :locked :repl-input.choice/ns "pirate.ui"}
                                           {:repl-input.choice/mode :following :repl-input.choice/ns "user"}]}
           (sut/indicator (assoc pirate-lock
                                 :repl-input.context/locked? true
                                 :repl-input.context/editor-ns "user"
                                 :repl-input.context/editor-session-key "cljs")
                          pirate-lock))))
  (testing "shows the session of each choice, with its build, when the entry's session and the editor's differ"
    (is (= [{:repl-input.choice/mode :locked :repl-input.choice/ns "pirate.ui" :repl-input.choice/session "cljs · :app"}
            {:repl-input.choice/mode :following :repl-input.choice/ns "pirate.ui" :repl-input.choice/session "clj"}]
           (:repl-input.indicator/choices
            (sut/indicator (assoc pirate-lock
                                  :repl-input.context/build ":app"
                                  :repl-input.context/locked? true
                                  :repl-input.context/editor-ns "pirate.ui"
                                  :repl-input.context/editor-session-key "clj")
                           pirate-lock))))
    (is (= ["cljs · :app" "cljs · :test"]
           (mapv :repl-input.choice/session
                 (:repl-input.indicator/choices
                  (sut/indicator (assoc pirate-lock
                                        :repl-input.context/build ":app"
                                        :repl-input.context/locked? true
                                        :repl-input.context/editor-ns "user"
                                        :repl-input.context/editor-session-key "cljs"
                                        :repl-input.context/editor-build ":test")
                                 pirate-lock)))))))

(deftest session-label-test
  (testing "is the session key, and the build after it for a session with a build"
    (is (= "clj" (sut/session-label "clj" nil)))
    (is (= "cljs · :app" (sut/session-label "cljs" ":app")))))

(defn- without-handlers
  "Returns `hiccup` without its event handlers."
  [hiccup]
  (walk/postwalk #(if (map? %) (dissoc % :on) %) hiccup))

(defn- element
  "Returns the first element of `hiccup` whose class includes `class-name`."
  [hiccup class-name]
  (->> (tree-seq #(or (vector? %) (seq? %)) #(if (vector? %) (rest %) %) hiccup)
       (filter #(and (vector? %) (map? (second %))
                     (let [classes (:class (second %))]
                       (some #{class-name} (if (string? classes) [classes] classes)))))
       first))

(defn- texts
  [hiccup]
  (filter string? (tree-seq #(or (vector? %) (seq? %)) #(if (vector? %) (rest %) %) hiccup)))

(deftest row-test
  (let [row (without-handlers (sut/row following-line nil false))]
    (testing "shows the followed namespace in the indicator, with the tooltip that says it follows the editor"
      (is (= {:class ["repl-input-context-button" "repl-input-indicator"]
              :hidden false
              :interestfor "output-tooltip"
              :aria-description "Following the editor. Evaluate an ns or in-ns form to lock to a namespace."
              :data-mode "following"
              :aria-label "user, following the editor"}
             (second (element row "repl-input-indicator"))))
      (is (= ["user"] (texts (element row "repl-input-indicator")))))
    (testing "disables the play button, and offers to connect, while no session answers"
      (is (= "true" (:aria-disabled (second (element row "repl-input-evaluate")))))
      (is (= "Connect a REPL to enable evaluations" (:aria-description (second (element row "repl-input-evaluate")))))
      (is (= ["Connect a REPL"] (texts (element row "repl-input-context-line"))))))
  (testing "enables the play button, and offers nothing to connect, while a session answers"
    (let [row (without-handlers (sut/row (assoc following-line :repl-input.context/connected? true) nil false))]
      (is (= "false" (:aria-disabled (second (element row "repl-input-evaluate")))))
      (is (= "Evaluate REPL Input" (:aria-description (second (element row "repl-input-evaluate")))))
      (is (empty? (texts (element row "repl-input-context-line"))))))
  (testing "hides the indicator until the context line has a namespace"
    (is (true? (:hidden (second (element (sut/row nil nil false) "repl-input-indicator"))))))
  (testing "makes the indicator a selector with a chevron, whose menu shows the choices, while a recalled entry locks the context"
    (let [locked-line (assoc pirate-lock
                             :repl-input.context/locked? true
                             :repl-input.context/editor-ns "user"
                             :repl-input.context/editor-session-key "cljs")
          row (without-handlers (sut/row locked-line pirate-lock true))
          indicator (element row "repl-input-indicator")]
      (is (= "menu" (:aria-haspopup (second indicator))))
      (is (= "true" (:aria-expanded (second indicator))) "The indicator tells that its menu is open")
      (is (element indicator "repl-input-indicator-chevron"))
      (is (= ["pirate.ui" "" "from the history" "user" "" "following the editor"]
             (texts (element row "repl-input-menu")))))))

(deftest evaluation-bar-test
  (is (false? (:hidden (second (sut/evaluation-bar :running)))) "Shows while an evaluation runs")
  (is (true? (:hidden (second (sut/evaluation-bar :reading-stdin)))) "Hides while the evaluation reads stdin")
  (is (true? (:hidden (second (sut/evaluation-bar nil))))))

(deftest controls-test
  (let [state {:repl-input/context-line following-line
               :repl-input/evaluation :reading-stdin
               :repl-input/dragging? true}
        [sash stdin-row context-row bar] (without-handlers (sut/controls state {:mac? true}))]
    (testing "puts the sash, the stdin input, the context line and the evaluation bar in order"
      (is (= ["repl-input-sash" "mac" "active"] (:class (second sash))) "The sash shows that it is dragged")
      (is (= "repl-input-stdin" (:class (second stdin-row))))
      (is (= "repl-input-context" (:class (second context-row))))
      (is (= "repl-input-evaluation-bar" (:class (second bar)))))
    (testing "shows the stdin input, and hides the evaluation bar, while the evaluation reads stdin"
      (is (false? (:hidden (second stdin-row))))
      (is (true? (:hidden (second bar)))))
    (testing "hides the stdin input when no evaluation reads stdin"
      (is (true? (:hidden (second (second (sut/controls {} {}))))))))
  (testing "dispatches the menu's toggle with whether it opened"
    (is (= [[:repl-input/ax.namespace-menu-toggled :event/open?]]
           (get-in (element (sut/row following-line nil false) "repl-input-menu") [1 :on :toggle])))))
