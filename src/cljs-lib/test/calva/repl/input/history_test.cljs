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

(defn- walk-from [record context direction]
  (let [{:keys [position stash] :as walked} (sut/walked entries record context direction)]
    [walked (assoc record
                   :repl-input/text (:text walked)
                   :repl-input/selections (:selections walked)
                   :repl-input.history/position position
                   :repl-input.history/stash stash)]))

(deftest walked-test
  (let [draft {:repl-input/text "(draft" :repl-input/selections [[6 6]]}
        following {:lock nil :context user}
        [newest after-newest] (walk-from draft following :back)
        [middle after-middle] (walk-from after-newest {:lock (:lock newest) :context pirate-ui} :back)
        [oldest after-oldest] (walk-from after-middle {:lock (:lock middle) :context pirate} :back)]
    (testing "walks back from the newest entry, with the cursor at the end of the first line"
      (is (= ["(js/alert 1)" [[12 12]]] ((juxt :text :selections) newest)))
      (is (= ["(inc a)\n(dec a)" [[7 7]]] ((juxt :text :selections) middle))))
    (testing "recalling an entry from another context locks that context"
      (is (= "pirate.ui" (:repl-input.context/ns (:lock newest))))
      (is (= "(ns pirate.core)" (:repl-input.context/ns-form (:lock middle)))))
    (testing "an entry from the context the walk started in brings back the lock from before"
      (is (= ["(def a 1)" nil] ((juxt :text :lock) oldest))))
    (testing "goes nowhere back from the oldest entry, and forward when not walking"
      (is (nil? (sut/walked entries after-oldest following :back)))
      (is (nil? (sut/walked entries draft following :forward))))
    (testing "walks forward, with the cursor at the end of the text"
      (let [[forward _] (walk-from after-oldest following :forward)]
        (is (= ["(inc a)\n(dec a)" [[15 15]]] ((juxt :text :selections) forward)))))
    (testing "walking past the newest entry brings back the text and the lock from before"
      (let [locked {:lock pirate :context pirate}
            [_ walking] (walk-from draft locked :back)
            [past _] (walk-from walking {:lock pirate-ui :context pirate-ui} :forward)]
        (is (= {:text "(draft" :selections [[6 6]] :position nil :stash nil :lock pirate} past))))
    (testing "goes nowhere in an empty history"
      (is (nil? (sut/walked [] draft following :back))))))

(deftest recalled-lock-test
  (testing "keeps the lock for an entry from the context's namespace and session"
    (is (nil? (sut/recalled-lock nil (assoc user :repl-input.context/locked? false) (first entries)))))
  (testing "locks the entry's context otherwise"
    (is (= pirate (sut/recalled-lock nil user (second entries))))))

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
