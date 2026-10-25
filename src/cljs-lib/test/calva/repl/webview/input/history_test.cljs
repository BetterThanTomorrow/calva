(ns calva.repl.webview.input.history-test
  (:require
   [calva.repl.webview.input.history :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(def ^:private on-line-2-of-3 {:cursors 1 :cursor-line 2 :line-count 3 :completion-open? false})

(deftest walk-direction-test
  (testing "up on the first line walks back, down on the last line walks forward"
    (is (= :back (sut/walk-direction (assoc on-line-2-of-3 :key :up :cursor-line 1))))
    (is (= :forward (sut/walk-direction (assoc on-line-2-of-3 :key :down :cursor-line 3))))
    (is (= [:back :forward] (map #(sut/walk-direction {:key % :cursors 1 :cursor-line 1 :line-count 1}) [:up :down]))))
  (testing "moves the cursor between the first and the last line"
    (is (nil? (sut/walk-direction (assoc on-line-2-of-3 :key :up))))
    (is (nil? (sut/walk-direction (assoc on-line-2-of-3 :key :down)))))
  (testing "leaves the keys to the cursors when there are several, and to the open completion list"
    (is (nil? (sut/walk-direction (assoc on-line-2-of-3 :key :up :cursor-line 1 :cursors 2))))
    (is (nil? (sut/walk-direction (assoc on-line-2-of-3 :key :up :cursor-line 1 :completion-open? true))))))

(def ^:private user
  {:repl-input.context/ns "user"
   :repl-input.context/ns-form "(in-ns 'user)"
   :repl-input.context/session-key "clj"})

(def ^:private pirate-ui
  {:repl-input.context/ns "pirate.ui"
   :repl-input.context/ns-form "(ns pirate.ui)"
   :repl-input.context/session-key "cljs"})

(def ^:private entries
  [(assoc user :repl-input.history/code "(def a 1)")
   (assoc user :repl-input.history/code "(inc a)\n(dec a)")
   (assoc pirate-ui :repl-input.history/code "(js/alert 1)")])

(def ^:private following-user
  {:repl-input/text "(draft"
   :repl-input/selections [[1 1]]
   :repl-input.history/entries entries
   :repl-input/context-line {:repl-input.context/ns "user" :repl-input.context/session-key "clj" :repl-input.context/locked? false}})

(defn- walk-from [db direction]
  (let [{walked :db :keys [shown]} (sut/walked db direction)]
    [shown (assoc walked :repl-input/text (:text shown) :repl-input/selections (:selections shown))]))

(deftest walked-test
  (let [[newest at-newest] (walk-from following-user :back)
        [middle at-middle] (walk-from at-newest :back)
        [oldest at-oldest] (walk-from at-middle :back)]
    (testing "walks back from the newest entry, with the cursor at the start of the entry"
      (is (= {:text "(js/alert 1)" :selections [[0 0]]} newest))
      (is (= {:text "(inc a)\n(dec a)" :selections [[0 0]]} middle))
      (is (= "(def a 1)" (:text oldest))))
    (testing "changes only the text and the walk, not the context line"
      (is (= (:repl-input/context-line following-user) (:repl-input/context-line at-oldest))))
    (testing "goes nowhere back from the oldest entry, and forward when not walking"
      (is (nil? (sut/walked at-oldest :back)))
      (is (nil? (sut/walked following-user :forward))))
    (testing "walks forward, with the cursor at the end of the entry"
      (is (= {:text "(inc a)\n(dec a)" :selections [[15 15]]} (first (walk-from at-oldest :forward)))))
    (testing "walking past the newest entry brings back the text from before the walk, with the cursor at its end, and ends the walk"
      (let [[shown past] (walk-from at-newest :forward)]
        (is (= {:text "(draft" :selections [[6 6]]} shown))
        (is (nil? (:repl-input.history/position past)))
        (is (nil? (:repl-input.history/stash past)))))
    (testing "goes nowhere in an empty history"
      (is (nil? (sut/walked (assoc following-user :repl-input.history/entries []) :back))))))

(deftest recalled-test
  (let [{recalled :db :keys [shown]} (sut/recalled following-user 1)]
    (testing "shows the picked entry, with the cursor at the end of the text"
      (is (= {:text "(inc a)\n(dec a)" :selections [[15 15]]} shown)))
    (testing "walks on from the picked entry, and back to the text from before"
      (is (= "(def a 1)" (:text (first (walk-from recalled :back)))))
      (is (= "(draft" (-> recalled (walk-from :forward) second (walk-from :forward) first :text)))))
  (testing "shows nothing for an entry the history doesn't have"
    (is (nil? (sut/recalled following-user 3)))))

(deftest entry-lock-test
  (let [[_ at-newest] (walk-from following-user :back)
        [_ at-middle] (walk-from at-newest :back)]
    (testing "offers to lock the namespace and session of a shown entry from another context"
      (is (= pirate-ui (sut/entry-lock at-newest))))
    (testing "offers nothing at an entry from the current context, or at the user's own text"
      (is (nil? (sut/entry-lock at-middle)))
      (is (nil? (sut/entry-lock following-user))))
    (testing "offers nothing once the context is the entry's"
      (is (nil? (sut/entry-lock (assoc at-newest :repl-input/context-line {:repl-input.context/ns "pirate.ui"
                                                                           :repl-input.context/session-key "cljs"
                                                                           :repl-input.context/locked? true})))))))
