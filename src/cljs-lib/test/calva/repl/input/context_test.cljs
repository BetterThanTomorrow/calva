(ns calva.repl.input.context-test
  (:require
   [calva.repl.input.context :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def ^:private editor-namespace
  {:repl-input.context/ns "pirate.lib"
   :repl-input.context/ns-form "(ns pirate.lib)"})

(def ^:private lock
  {:repl-input.context/ns "pirate.core"
   :repl-input.context/ns-form "(in-ns 'pirate.core)"
   :repl-input.context/session-key "clj:2"})

(deftest current-test
  (testing "follows the last active Clojure editor's namespace at its cursor, in the session routing gives that editor"
    (is (= {:repl-input.context/ns "pirate.lib"
            :repl-input.context/ns-form "(ns pirate.lib)"
            :repl-input.context/session-key "cljs"
            :repl-input.context/locked? false
            :repl-input.context/connected? true}
           (sut/current {:editor-namespace editor-namespace
                         :routed-session-key "cljs"
                         :session-keys ["clj" "cljs"]}))))

  (testing "is `user` before any Clojure editor has been active, in the session routing gives without a document"
    (is (= {:repl-input.context/ns "user"
            :repl-input.context/ns-form "(in-ns 'user)"
            :repl-input.context/session-key "clj"
            :repl-input.context/locked? false
            :repl-input.context/connected? true}
           (sut/current {:routed-session-key "clj"
                         :session-keys ["clj" "cljs"]}))))

  (testing "is not connected when no session is connected"
    (is (false? (:repl-input.context/connected? (sut/current {:editor-namespace editor-namespace})))))

  (testing "keeps the locked namespace and session key over the followed editor and the routed session, which a newly pinned session gives"
    (is (= (assoc lock
                  :repl-input.context/locked? true
                  :repl-input.context/connected? true)
           (sut/current {:lock lock
                         :editor-namespace editor-namespace
                         :routed-session-key "cljs"
                         :session-keys ["clj:2" "cljs"]}))))

  (testing "keeps the locked session key while its session is disconnected, and is connected again when a reconnect reuses the key"
    (is (= ["clj:2" false]
           ((juxt :repl-input.context/session-key :repl-input.context/connected?)
            (sut/current {:lock lock :routed-session-key "cljs" :session-keys ["cljs"]}))))
    (is (= ["clj:2" true]
           ((juxt :repl-input.context/session-key :repl-input.context/connected?)
            (sut/current {:lock lock :routed-session-key "cljs" :session-keys ["cljs" "clj:2"]}))))))

(def ^:private followed
  (sut/current {:editor-namespace editor-namespace :routed-session-key "cljs" :session-keys ["cljs"]}))

(deftest lock-after-test
  (testing "locks the namespace of an evaluated ns form, in the session it was evaluated in, when the evaluation succeeds"
    (is (= {:repl-input.context/ns "pirate.core"
            :repl-input.context/ns-form "(ns pirate.core)"
            :repl-input.context/session-key "cljs"}
           (sut/lock-after nil followed ["pirate.core" "(ns pirate.core)"] true))))

  (testing "locks the namespace of an evaluated in-ns form"
    (is (= "pirate.core"
           (:repl-input.context/ns (sut/lock-after nil followed ["pirate.core" "(in-ns 'pirate.core)"] true)))))

  (testing "moves an existing lock to the namespace of an evaluated ns form"
    (is (= "pirate.ui"
           (:repl-input.context/ns (sut/lock-after lock (sut/current {:lock lock}) ["pirate.ui" "(ns pirate.ui)"] true))))
    (is (= "clj:2"
           (:repl-input.context/session-key (sut/lock-after lock (sut/current {:lock lock}) ["pirate.ui" "(ns pirate.ui)"] true)))))

  (testing "keeps the lock as it was when the evaluation fails"
    (is (nil? (sut/lock-after nil followed ["pirate.core" "(ns pirate.core)"] false)))
    (is (= lock (sut/lock-after lock followed ["pirate.ui" "(ns pirate.ui)"] false))))

  (testing "keeps the lock as it was when the code has no ns or in-ns form"
    (is (nil? (sut/lock-after nil followed nil true)))
    (is (= lock (sut/lock-after lock followed nil true)))))

(deftest evaluation-context-test
  (let [context (assoc lock :repl-input.context/locked? true :repl-input.context/connected? true)]
    (testing "keeps the context where the overrides name nothing"
      (is (= context
             (sut/evaluation-context context
                                     {:repl-input.context/ns nil
                                      :repl-input.context/ns-form nil
                                      :repl-input.context/session-key nil}
                                     ["clj:2"]))))
    (testing "takes the namespace and session the overrides name, connected by the session keys"
      (is (= (assoc context
                    :repl-input.context/ns "pirate.util"
                    :repl-input.context/ns-form "(in-ns 'pirate.util)"
                    :repl-input.context/session-key "cljs"
                    :repl-input.context/connected? false)
             (sut/evaluation-context context
                                     {:repl-input.context/ns "pirate.util"
                                      :repl-input.context/ns-form "(in-ns 'pirate.util)"
                                      :repl-input.context/session-key "cljs"}
                                     ["clj:2"]))))))

(deftest line-test
  (testing "following the editor"
    (is (= {:repl-input.context/ns "pirate.lib"
            :repl-input.context/session "cljs"
            :repl-input.context/hint "following the editor · an ns or in-ns form locks the namespace"
            :repl-input.context/locked? false
            :repl-input.context/connected? true}
           (sut/line followed))))

  (testing "locked"
    (is (= {:repl-input.context/ns "pirate.core"
            :repl-input.context/session "clj:2"
            :repl-input.context/hint "locked · click to follow the editor"
            :repl-input.context/locked? true
            :repl-input.context/connected? true}
           (sut/line (sut/current {:lock lock :session-keys ["clj:2"]})))))

  (testing "locked to a session that isn't connected"
    (is (= {:repl-input.context/ns "pirate.core"
            :repl-input.context/session "clj:2 isn't connected"
            :repl-input.context/hint "locked · click to follow the editor"
            :repl-input.context/locked? true
            :repl-input.context/connected? false}
           (sut/line (sut/current {:lock lock :session-keys ["cljs"]})))))

  (testing "no REPL connected"
    (is (= {:repl-input.context/ns "user"
            :repl-input.context/session "the REPL isn't connected"
            :repl-input.context/hint "following the editor · an ns or in-ns form locks the namespace"
            :repl-input.context/locked? false
            :repl-input.context/connected? false}
           (sut/line (sut/current {}))))))

(deftest not-connected-message-test
  (testing "names the session that isn't connected"
    (is (= "Not evaluated: the REPL session clj:2 isn't connected"
           (sut/not-connected-message (sut/current {:lock lock})))))

  (testing "says that the REPL isn't connected when there is no session"
    (is (= "Not evaluated: the REPL isn't connected"
           (sut/not-connected-message (sut/current {}))))))
