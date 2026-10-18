(ns calva.docs.markdown-test
  (:require [calva.docs.markdown :as markdown]
            [clojure.test :refer [deftest is testing]]))

(deftest heading-ids
  (testing "ids are lower-case words joined by dashes, without punctuation"
    (is (= ["the-calva-extension-api" "replcurrentsessionkey" "what-youll-learn" "cafe"]
           (markdown/heading-ids ["The Calva Extension API" "repl.currentSessionKey()"
                                  "What you'll learn" "Café"]))))
  (testing "repeated and empty ids get numbered suffixes"
    (is (= ["notes" "notes_1" "notes_2" "_1"]
           (markdown/heading-ids ["Notes" "Notes" "Notes" "!!!"])))))
