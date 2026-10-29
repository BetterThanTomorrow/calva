(ns calva.repl.webview.input.context-test
  (:require
   [calva.repl.webview.input.context :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

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
