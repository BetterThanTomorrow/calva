(ns calva.repl.input.context-test
  (:require
   [calva.repl.input.context :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def ^:private editor-namespace
  {:repl-input.context/ns "pirate.lib"
   :repl-input.context/ns-form "(ns pirate.lib)"})

(def ^:private lib-file "file:///pirate/src/pirate/lib.cljs")

(def ^:private core-file "file:///pirate/src/pirate/core.cljc")

(def ^:private route
  "Routing a source file, or without one, as the router does it now."
  {lib-file "cljs" core-file "clj:2" nil "clj"})

(def ^:private lock
  {:repl-input.context/ns "pirate.core"
   :repl-input.context/ns-form "(in-ns 'pirate.core)"
   :repl-input.context/source-file core-file})

(deftest current-following-test
  (testing "follows the last active Clojure editor's namespace at its cursor, with its file as the source file, in the session routing gives that file"
    (is (= {:repl-input.context/ns "pirate.lib"
            :repl-input.context/ns-form "(ns pirate.lib)"
            :repl-input.context/source-file lib-file
            :repl-input.context/session-key "cljs"
            :repl-input.context/locked? false
            :repl-input.context/connected? true
            :repl-input.context/editor-ns "pirate.lib"
            :repl-input.context/editor-session-key "cljs"}
           (sut/current {:editor-namespace editor-namespace
                         :editor-file lib-file
                         :route route
                         :session-keys ["clj" "cljs"]}))))

  (testing "is `user` before any Clojure editor has been active, without a source file, in the session routing gives without a document"
    (is (= {:repl-input.context/ns "user"
            :repl-input.context/ns-form "(in-ns 'user)"
            :repl-input.context/source-file nil
            :repl-input.context/session-key "clj"
            :repl-input.context/locked? false
            :repl-input.context/connected? true
            :repl-input.context/editor-ns "user"
            :repl-input.context/editor-session-key "clj"}
           (sut/current {:route route
                         :session-keys ["clj" "cljs"]}))))

  (testing "is not connected when no session is connected"
    (is (false? (:repl-input.context/connected? (sut/current {:editor-namespace editor-namespace :route route}))))))

(deftest current-locked-test
  (testing "keeps the locked namespace over the followed editor's, in the session routing gives the lock's source file, and knows the editor's namespace and session"
    (is (= (assoc lock
                  :repl-input.context/session-key "clj:2"
                  :repl-input.context/locked? true
                  :repl-input.context/connected? true
                  :repl-input.context/editor-ns "pirate.lib"
                  :repl-input.context/editor-session-key "cljs")
           (sut/current {:lock lock
                         :editor-namespace editor-namespace
                         :editor-file lib-file
                         :route route
                         :session-keys ["clj:2" "cljs"]}))))

  (testing "routes the lock's source file again when routing changes, as a pin or a cljc target makes it"
    (is (= "cljs"
           (:repl-input.context/session-key
            (sut/current {:lock lock :route (assoc route core-file "cljs") :session-keys ["clj:2" "cljs"]})))))

  (testing "keeps the lock while its source file routes to no connected session, and is connected again when a session answers"
    (is (= ["clj:2" false]
           ((juxt :repl-input.context/session-key :repl-input.context/connected?)
            (sut/current {:lock lock :route route :session-keys ["cljs"]}))))
    (is (= ["clj:2" true]
           ((juxt :repl-input.context/session-key :repl-input.context/connected?)
            (sut/current {:lock lock :route route :session-keys ["cljs" "clj:2"]})))))

  (testing "a lock without a source file is in the session key it keeps, and without one in the session routing gives without a document"
    (is (= "cljs:3"
           (:repl-input.context/session-key
            (sut/current {:lock (-> lock
                                    (dissoc :repl-input.context/source-file)
                                    (assoc :repl-input.context/session-key "cljs:3"))
                          :route route}))))
    (is (= "clj"
           (:repl-input.context/session-key
            (sut/current {:lock (dissoc lock :repl-input.context/source-file) :route route}))))))

(deftest routed-session-key-test
  (testing "routes the source file of a lock or a history entry now, over the session key it keeps"
    (is (= "clj:2" (sut/routed-session-key route {:repl-input.context/source-file core-file
                                                    :repl-input.context/session-key "cljs"}))))
  (testing "is the session key it keeps without a source file, as for entries kept before"
    (is (= "cljs" (sut/routed-session-key route {:repl-input.context/session-key "cljs"}))))
  (testing "routes without a document with neither"
    (is (= "clj" (sut/routed-session-key route {})))))

(def ^:private followed
  (sut/current {:editor-namespace editor-namespace :editor-file lib-file :route route :session-keys ["cljs"]}))

(deftest lock-after-test
  (testing "locks the namespace of an evaluated ns form, with the source file of the context it was evaluated in, when the evaluation succeeds"
    (is (= {:repl-input.context/ns "pirate.core"
            :repl-input.context/ns-form "(ns pirate.core)"
            :repl-input.context/source-file lib-file}
           (sut/lock-after nil followed ["pirate.core" "(ns pirate.core)"] true))))

  (testing "locks the namespace of an evaluated in-ns form"
    (is (= "pirate.core"
           (:repl-input.context/ns (sut/lock-after nil followed ["pirate.core" "(in-ns 'pirate.core)"] true)))))

  (testing "moves an existing lock to the namespace of an evaluated ns form, with the lock's source file"
    (is (= {:repl-input.context/ns "pirate.ui"
            :repl-input.context/ns-form "(ns pirate.ui)"
            :repl-input.context/source-file core-file}
           (sut/lock-after lock (sut/current {:lock lock :route route}) ["pirate.ui" "(ns pirate.ui)"] true))))

  (testing "locks without a source file before any Clojure editor was followed, and keeps no session key, so that the lock routes without a document"
    (is (= {:repl-input.context/ns "pirate.core"
            :repl-input.context/ns-form "(ns pirate.core)"}
           (sut/lock-after nil (sut/current {:route route}) ["pirate.core" "(ns pirate.core)"] true))))

  (testing "keeps the session key of a lock without a source file, as one from a history entry kept before"
    (let [kept-lock (-> lock
                        (dissoc :repl-input.context/source-file)
                        (assoc :repl-input.context/session-key "cljs:3"))]
      (is (= "cljs:3"
             (:repl-input.context/session-key
              (sut/lock-after kept-lock (sut/current {:lock kept-lock :route route}) ["pirate.ui" "(ns pirate.ui)"] true))))))

  (testing "keeps the lock as it was when the evaluation fails"
    (is (nil? (sut/lock-after nil followed ["pirate.core" "(ns pirate.core)"] false)))
    (is (= lock (sut/lock-after lock followed ["pirate.ui" "(ns pirate.ui)"] false))))

  (testing "keeps the lock as it was when the code has no ns or in-ns form"
    (is (nil? (sut/lock-after nil followed nil true)))
    (is (= lock (sut/lock-after lock followed nil true)))))

(deftest as-lock-test
  (testing "keeps the namespace, ns form and source file of a history entry, without the session key that routing gave it"
    (is (= lock (sut/as-lock (assoc lock
                                    :repl-input.history/code "(inc 1)"
                                    :repl-input.context/session-key "cljs")))))

  (testing "keeps the session key of an entry without a source file"
    (is (= {:repl-input.context/ns "pirate.core"
            :repl-input.context/ns-form "(in-ns 'pirate.core)"
            :repl-input.context/session-key "cljs"}
           (sut/as-lock (-> lock
                            (dissoc :repl-input.context/source-file)
                            (assoc :repl-input.context/session-key "cljs")))))))

(deftest evaluation-context-test
  (let [context (sut/current {:lock lock :route route :session-keys ["clj:2"]})]
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
  (testing "following the editor, with the ns form, the source file, and the editor's namespace and session"
    (is (= {:repl-input.context/ns "pirate.lib"
            :repl-input.context/ns-form "(ns pirate.lib)"
            :repl-input.context/source-file lib-file
            :repl-input.context/session-key "cljs"
            :repl-input.context/locked? false
            :repl-input.context/connected? true
            :repl-input.context/editor-ns "pirate.lib"
            :repl-input.context/editor-session-key "cljs"}
           (sut/line followed))))

  (testing "locked, with the namespace and session that following the editor would give"
    (is (= {:repl-input.context/ns "pirate.core"
            :repl-input.context/ns-form "(in-ns 'pirate.core)"
            :repl-input.context/source-file core-file
            :repl-input.context/session-key "clj:2"
            :repl-input.context/locked? true
            :repl-input.context/connected? true
            :repl-input.context/editor-ns "pirate.lib"
            :repl-input.context/editor-session-key "cljs"}
           (sut/line (sut/current {:lock lock :editor-namespace editor-namespace :editor-file lib-file
                                   :route route :session-keys ["clj:2"]})))))

  (testing "locked to a source file that routes to a session that isn't connected"
    (is (= {:repl-input.context/session-key "clj:2"
            :repl-input.context/connected? false
            :repl-input.context/editor-ns "user"
            :repl-input.context/editor-session-key "clj"}
           (select-keys (sut/line (sut/current {:lock lock :route route :session-keys ["cljs"]}))
                        [:repl-input.context/session-key :repl-input.context/connected?
                         :repl-input.context/editor-ns :repl-input.context/editor-session-key]))))

  (testing "no REPL connected"
    (is (= {:repl-input.context/ns "user"
            :repl-input.context/ns-form "(in-ns 'user)"
            :repl-input.context/source-file nil
            :repl-input.context/session-key nil
            :repl-input.context/locked? false
            :repl-input.context/connected? false
            :repl-input.context/editor-ns "user"
            :repl-input.context/editor-session-key nil}
           (sut/line (sut/current {:route {}}))))))

(deftest with-builds-test
  (let [build {"cljs" ":app" "cljs:2" ":test"}
        locked (sut/current {:lock (assoc lock :repl-input.context/source-file lib-file)
                             :editor-file core-file :route route :session-keys ["cljs"]})]
    (testing "gives the context the build of its session and of the editor's session"
      (is (= [":app" nil]
             ((juxt :repl-input.context/build :repl-input.context/editor-build) (sut/with-builds locked build)))))
    (testing "the context line shows them"
      (is (= {:repl-input.context/build ":app" :repl-input.context/editor-build nil}
             (select-keys (sut/line (sut/with-builds locked build))
                          [:repl-input.context/build :repl-input.context/editor-build]))))
    (testing "has no build without a session"
      (is (nil? (:repl-input.context/build (sut/with-builds (sut/current {:route {}}) build)))))))

(deftest not-connected-message-test
  (testing "names the session that isn't connected"
    (is (= "Not evaluated: the REPL session clj:2 isn't connected"
           (sut/not-connected-message (sut/current {:lock lock :route route})))))

  (testing "says that the REPL isn't connected when there is no session"
    (is (= "Not evaluated: the REPL isn't connected"
           (sut/not-connected-message (sut/current {:route {}}))))))
