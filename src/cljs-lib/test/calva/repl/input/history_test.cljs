(ns calva.repl.input.history-test
  (:require
   [calva.repl.input.history :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def ^:private user
  {:repl-input.context/ns "user"
   :repl-input.context/ns-form "(in-ns 'user)"
   :repl-input.context/session-key "clj"})

(def ^:private core-file "file:///pirate/src/pirate/core.clj")

(def ^:private ui-file "file:///pirate/src/pirate/ui.cljs")

(def ^:private pirate
  {:repl-input.context/ns "pirate.core"
   :repl-input.context/ns-form "(ns pirate.core)"
   :repl-input.context/session-key "clj"
   :repl-input.context/source-file core-file})

(def ^:private pirate-ui
  {:repl-input.context/ns "pirate.ui"
   :repl-input.context/ns-form "(ns pirate.ui)"
   :repl-input.context/session-key "cljs"
   :repl-input.context/source-file ui-file})

(def ^:private entries
  [(sut/entry "(def a 1)" user)
   (sut/entry "(inc a)\n(dec a)" pirate)
   (sut/entry "(js/alert 1)" pirate-ui)])

(deftest add-test
  (testing "adds the evaluated code with its context and source file, trimmed"
    (is (= [{:repl-input.history/code "(def a 1)"
             :repl-input.context/ns "user" :repl-input.context/ns-form "(in-ns 'user)" :repl-input.context/session-key "clj"
             :repl-input.context/source-file nil}]
           (sut/add [] (sut/entry " (def a 1)\n" (assoc user :repl-input.context/locked? true))))))
  (testing "keeps the source file the context followed or was locked with"
    (is (= core-file (:repl-input.context/source-file (sut/entry "(inc a)" pirate)))))
  (testing "skips blank code, and the same code in the same context as the last entry"
    (is (= 1 (count (-> []
                        (sut/add (sut/entry "(def a 1)" user))
                        (sut/add (sut/entry "(def a 1)" user))
                        (sut/add (sut/entry "  " user)))))))
  (testing "skips the same code in the same namespace and source file in another session, as after a cljc target switch"
    (is (= 1 (count (-> []
                        (sut/add (sut/entry "(inc a)" pirate))
                        (sut/add (sut/entry "(inc a)" (assoc pirate :repl-input.context/session-key "cljs"))))))))
  (testing "keeps the same code evaluated in another context"
    (is (= 2 (count (-> []
                        (sut/add (sut/entry "(def a 1)" user))
                        (sut/add (sut/entry "(def a 1)" pirate))))))
    (is (= 2 (count (-> []
                        (sut/add (sut/entry "(def a 1)" user))
                        (sut/add (sut/entry "(def a 1)" (assoc user :repl-input.context/session-key "cljs"))))))
        "Without a source file, another session is another context")))

(deftest add-keeps-the-latest-test
  (let [added (reduce sut/add [] (map #(sut/entry (str "(inc " % ")") user) (range (+ 2 sut/kept-count))))]
    (is (= sut/kept-count (count added))
        "Keeps `kept-count` entries")
    (is (= ["(inc 2)" (str "(inc " (inc sut/kept-count) ")")]
           (map :repl-input.history/code [(first added) (peek added)]))
        "Drops the oldest")))

(deftest pick-items-test
  (testing "newest first, the code on one line as the label, the namespace as the description"
    (is (= [{:label "(js/alert 1)" :description "pirate.ui" :index 2}
            {:label "(inc a) (dec a)" :description "pirate.core" :index 1}
            {:label "(def a 1)" :description "user" :index 0}]
           (sut/pick-items entries))))
  (testing "escapes what the quick pick would show as an icon"
    (is (= [{:label "(str \"\\$(edit)\" \\$(x))" :description "user" :index 0}]
           (sut/pick-items [(sut/entry "(str \"$(edit)\" $(x))" user)])))))

(deftest stored-test
  (testing "keeps the entries in workspaceState as plain maps, and reads them back"
    (is (= {:code "(inc a)\n(dec a)" :ns "pirate.core" :nsForm "(ns pirate.core)" :sessionKey "clj" :sourceFile core-file}
           (second (sut/stored entries))))
    (is (= entries (sut/from-stored (js->clj (clj->js (sut/stored entries)) :keywordize-keys true)))))
  (testing "reads entries kept without a source file"
    (is (= [(assoc (sut/entry "(inc a)" pirate) :repl-input.context/source-file nil)]
           (sut/from-stored [{:code "(inc a)" :ns "pirate.core" :nsForm "(ns pirate.core)" :sessionKey "clj"}]))))
  (testing "skips what workspaceState keeps that isn't an entry"
    (is (= [(first entries)] (sut/from-stored ["(+ 1 2)" {:id 7} (first (sut/stored entries))]))))
  (testing "reads entries kept with the evaluation id they once had"
    (is (= [(first entries)] (sut/from-stored [(assoc (first (sut/stored entries)) :id 1)])))))

(deftest routed-test
  (let [routed-files (atom [])
        route (fn [source-file]
                (swap! routed-files conj source-file)
                (get {core-file "clj:2" ui-file "cljs" nil "clj"} source-file))
        kept-before {:repl-input.history/code "(dec a)"
                     :repl-input.context/ns "pirate.core"
                     :repl-input.context/ns-form "(ns pirate.core)"
                     :repl-input.context/session-key "cljs:3"}
        routed (sut/routed (conj entries (second entries) kept-before) route)]
    (testing "gives each entry the session key that routing its source file gives now"
      (is (= ["clj:2" "cljs" "clj:2"] (mapv :repl-input.context/session-key (take 3 (rest routed))))))
    (testing "keeps the session key of an entry without a source file"
      (is (= ["clj" "cljs:3"] (mapv :repl-input.context/session-key [(first routed) (last routed)]))))
    (testing "routes each source file once"
      (is (= [core-file ui-file] @routed-files)))
    (testing "keeps the rest of the entries"
      (is (= (map #(dissoc % :repl-input.context/session-key) entries)
             (map #(dissoc % :repl-input.context/session-key) (take 3 routed)))))))
