(ns calva.repl.input.history-test
  (:require
   [calva.repl.input.history :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def ^:private user
  {:repl-input.context/ns "user"
   :repl-input.context/ns-form "(in-ns 'user)"
   :repl-input.context/session-key "clj"})

(def ^:private pirate
  {:repl-input.context/ns "pirate.core"
   :repl-input.context/ns-form "(ns pirate.core)"
   :repl-input.context/session-key "clj"})

(def ^:private pirate-ui
  {:repl-input.context/ns "pirate.ui"
   :repl-input.context/ns-form "(ns pirate.ui)"
   :repl-input.context/session-key "cljs"})

(def ^:private entries
  [(sut/entry "(def a 1)" user)
   (sut/entry "(inc a)\n(dec a)" pirate)
   (sut/entry "(js/alert 1)" pirate-ui)])

(deftest add-test
  (testing "adds the evaluated code with its context, trimmed"
    (is (= [{:repl-input.history/code "(def a 1)"
             :repl-input.context/ns "user" :repl-input.context/ns-form "(in-ns 'user)" :repl-input.context/session-key "clj"}]
           (sut/add [] (sut/entry " (def a 1)\n" (assoc user :repl-input.context/locked? true))))))
  (testing "skips blank code, and the same code in the same context as the last entry"
    (is (= 1 (count (-> []
                        (sut/add (sut/entry "(def a 1)" user))
                        (sut/add (sut/entry "(def a 1)" user))
                        (sut/add (sut/entry "  " user)))))))
  (testing "keeps the same code evaluated in another context"
    (is (= 2 (count (-> []
                        (sut/add (sut/entry "(def a 1)" user))
                        (sut/add (sut/entry "(def a 1)" pirate))))))))

(deftest visible-test
  (testing "filters by the session the REPL Input evaluates in when the setting says so"
    (is (= ["(js/alert 1)"] (mapv :repl-input.history/code (sut/visible entries "cljs" true))))
    (is (= 3 (count (sut/visible entries "cljs" false))))))

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
    (is (= {:code "(inc a)\n(dec a)" :ns "pirate.core" :nsForm "(ns pirate.core)" :sessionKey "clj"}
           (second (sut/stored entries))))
    (is (= entries (sut/from-stored (js->clj (clj->js (sut/stored entries)) :keywordize-keys true)))))
  (testing "skips what workspaceState keeps that isn't an entry"
    (is (= [(first entries)] (sut/from-stored ["(+ 1 2)" {:id 7} (first (sut/stored entries))]))))
  (testing "reads entries kept with the evaluation id they once had"
    (is (= [(first entries)] (sut/from-stored [(assoc (first (sut/stored entries)) :id 1)])))))
