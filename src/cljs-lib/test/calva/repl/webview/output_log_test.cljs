(ns calva.repl.webview.output-log-test
  (:require
   [calva.repl.webview.output-log :as sut]
   [cljs.test :refer-macros [deftest is]]))

(def result {:command/name "show-result" :output "42"})

(def stdout {:command/name "show-stdout" :output "hello"})

(defn- logged
  "Returns the empty log with each `[view-id message]` of `posts` posted."
  [posts]
  (reduce (fn [log [view-id message]] (sut/with-message log view-id message)) sut/empty-log posts))

(deftest with-message-test
  (is (= [result] (sut/view-messages (logged [["output-view" result]]) "output-view"))
      "Logs the message for the view")
  (is (= [] (sut/view-messages (logged [["output-view" result]]) "output-sidebar"))
      "Not for the other view")
  (is (= [result] (sut/view-messages (logged [["output-view" (assoc result :output/highlighting [[0 2]])]])
                                     "output-view"))
      "Without printed code's highlighting"))

(deftest same-message-to-both-views-test
  (let [log (logged [["output-view" result] ["output-sidebar" result]])]
    (is (= [[result] [result]] [(sut/view-messages log "output-view") (sut/view-messages log "output-sidebar")])
        "Each view has the message")
    (is (= {:message result :views #{"output-view" "output-sidebar"}} (:output-log/last log))
        "In one entry"))
  (is (= [result result] (sut/view-messages (logged [["output-view" result] ["output-view" result]]) "output-view"))
      "The same message twice to one view is two entries")
  (is (= [result stdout result]
         (sut/view-messages (logged [["output-view" result] ["output-view" stdout] ["output-sidebar" result]
                                     ["output-view" result]])
                            "output-view"))
      "Only the last entry takes another view"))

(deftest kept-count-test
  (let [log (logged (map (fn [i] ["output-view" {:output i}]) (range (+ 2 sut/kept-count))))
        messages (sut/view-messages log "output-view")]
    (is (= sut/kept-count (count messages))
        "Keeps `kept-count` entries")
    (is (= [2 (inc sut/kept-count)] [(:output (first messages)) (:output (last messages))])
        "Drops the oldest")))

(deftest without-view-test
  (let [log (sut/without-view (logged [["output-view" result] ["output-sidebar" result]
                                       ["output-sidebar" stdout] ["output-view" stdout]])
                              "output-view")]
    (is (= [] (sut/view-messages log "output-view"))
        "The view has no messages left")
    (is (= [result stdout] (sut/view-messages log "output-sidebar"))
        "The other view keeps its messages")
    (is (= 1 (count (:output-log/entries log)))
        "Entries no view has left are dropped"))
  (is (= sut/empty-log (sut/without-view (logged [["output-view" result]]) "output-view"))
      "A log without views left is empty")
  (is (= [stdout] (sut/view-messages (sut/with-message (sut/without-view (logged [["output-view" result]])
                                                                         "output-view")
                                                       "output-view"
                                                       stdout)
                                     "output-view"))
      "Logs again after a clear"))
