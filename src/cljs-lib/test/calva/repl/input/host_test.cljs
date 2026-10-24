(ns calva.repl.input.host-test
  (:require
   [calva.repl.input.host :as sut]
   [cljs.test :refer-macros [deftest testing is]]))

(defn- with-fresh-host [f]
  (let [contexts (atom [])]
    (with-redefs [sut/!state (atom {:repl-input/records {}
                                    :repl-input/focused nil
                                    :repl-input/overrides {}})
                  sut/!set-context (atom (fn [k v] (swap! contexts conj [k v])))]
      (f contexts))))

(defn- post! [m]
  (sut/handle-message! (clj->js m :keyword-fn #(subs (str %) 1))))

(deftest handle-message!-records-test
  (with-fresh-host
    (fn [_]
      (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "" :selections []})
      (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 2 :text "(+ 1 2)" :selections [[7 7]]})
      (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 1 :text "(+ 1" :selections [[4 4]]})
      (testing "keeps the newest change for the REPL Input"
        (is (= {:repl-input/id "output-view" :repl-input/version 2 :repl-input/text "(+ 1 2)" :repl-input/selections [[7 7]]}
               (get-in @sut/!state [:repl-input/records "output-view"]))))
      (post! {:command "repl-input-unmounted" :repl-input/id "output-view"})
      (testing "drops the record when the REPL Input unmounts"
        (is (= {} (:repl-input/records @sut/!state)))))))

(deftest handle-message!-focus-test
  (with-fresh-host
    (fn [contexts]
      (post! {:command "repl-input-focused" :repl-input/id "output-sidebar"})
      (testing "sets the focus context when a REPL Input gets focus"
        (is (= [["calva:replInputFocused" true]] @contexts))
        (is (sut/focused?)))
      (post! {:command "repl-input-focused" :repl-input/id "output-view"})
      (testing "leaves the context as it is when focus moves between REPL Inputs"
        (is (= [["calva:replInputFocused" true]] @contexts)))
      (post! {:command "repl-input-blurred" :repl-input/id "output-sidebar"})
      (testing "ignores a late blur from the REPL Input that lost focus earlier"
        (is (= 1 (count @contexts))))
      (sut/text-editor-focused!)
      (testing "clears the context when a text editor gets focus"
        (is (= ["calva:replInputFocused" false] (last @contexts)))
        (is (not (sut/focused?)))))))

(deftest view-lifecycle-focus-test
  (with-fresh-host
    (fn [contexts]
      (post! {:command "repl-input-focused" :repl-input/id "output-view"})
      (sut/view-hidden! "output-view")
      (testing "clears the context when the view is hidden"
        (is (= ["calva:replInputFocused" false] (last @contexts))))
      (post! {:command "repl-input-focused" :repl-input/id "output-view"})
      (sut/view-disposed! "output-view")
      (testing "clears the context when the view is disposed"
        (is (= ["calva:replInputFocused" false] (last @contexts)))
        (is (= 4 (count @contexts)))))))
