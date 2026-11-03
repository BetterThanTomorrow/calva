(ns calva.repl.webview.output-messages-test
  (:require
   [calva.repl.webview.output-messages :as sut]
   [calva.repl.webview.printed-brackets :as printed-brackets]
   [cljs.test :refer-macros [deftest testing is]]))

(deftest folded-result-message-test
  (with-redefs [printed-brackets/settings #(throw (js/Error. "A folded result needs no colors"))]
    (let [text (apply str (repeat 6000 "y"))
          message (sut/output-message {} "show-result" "evalResults" text)]
      (is (= {:command/name "show-result" :output-category "evalResults" :output text} message)
          "A result that will be folded is posted without highlighting, which is asked for when it is unfolded"))
    (is (thrown? js/Error (sut/output-message {} "show-result" "clojure" (apply str (repeat 6000 "y"))))
        "Other Clojure output isn't folded, so it gets its colors as before")))

(deftest options->meta-test
  (testing "Given nil options, should return nil"
    (is (nil? (sut/options->meta nil))))
  (testing "Given a map of options with only :who, should return a map with only :meta/who"
    (is (= {:meta/who "repl"}
           (sut/options->meta {:who "repl"}))))
  (testing "Given a map of options with all supported keys, should return the expected map"
    (is (= {:meta/who "repl"
            :meta/ns "user"
            :meta/repl-session-key "clj"
            :meta/shadow-build "app"
            :meta/shadow-runtime-id 1}
           (sut/options->meta {:who "repl"
                               :ns "user"
                               :replSessionKey "clj"
                               :shadowBuild "app"
                               :shadowRuntimeId 1}))))
  (testing "Given a JS object with all supported keys, should return the expected map"
    (is (= {:meta/who "repl"
            :meta/ns "user"
            :meta/repl-session-key "clj"
            :meta/shadow-build "app"
            :meta/shadow-runtime-id 1
            :meta/evaluation-id 7}
           (sut/options->meta (clj->js {:who "repl"
                                        :ns "user"
                                        :replSessionKey "clj"
                                        :shadowBuild "app"
                                        :shadowRuntimeId 1
                                        :evaluationId 7})))))
  (testing "Given options with no recognized keys, should return an empty map"
    (is (= {} (sut/options->meta {:outputCategory "evalOut"}))))
  (testing "Given options with shadow-runtime-id 0, should include it"
    (is (= {:meta/shadow-runtime-id 0}
           (sut/options->meta {:shadowRuntimeId 0})))))

(deftest error-message-test
  (testing "Given options, the error text and JS cause messages,"
    (let [causes (clj->js [{:class "clojure.lang.ExceptionInfo"
                            :message "Could not start"
                            :phase []
                            :id "7"
                            :stacktrace [{:name "myproj.core$start_BANG_/invokeStatic"
                                          :file-url []
                                          :flags ["project" "clj"]}]}])]
      (testing "should return one show-error message with the causes as data"
        (is (= {:command/name "show-error"
                :error/text "Execution error"
                :error/category "evalErr"
                :error/causes [{:class "clojure.lang.ExceptionInfo"
                                :message "Could not start"
                                :phase nil
                                :stacktrace [{:name "myproj.core$start_BANG_/invokeStatic"
                                              :file-url nil
                                              :flags #{"project" "clj"}}]}]
                :error/unfolded? false
                :id "e1"
                :meta {:meta/ns "user"}}
               (sut/error-message (clj->js {:outputCategory "evalErr" :ns "user"})
                                  "Execution error"
                                  causes
                                  "e1"))))
      (testing "should start unfolded when the options say so"
        (is (true? (:error/unfolded? (sut/error-message (clj->js {:outputCategory "evalErr" :unfolded true})
                                                        "Execution error"
                                                        causes
                                                        "e1")))))))
  (testing "Given causes that come later, should return a message without causes"
    (is (= [] (:error/causes (sut/error-message (clj->js {:outputCategory "evalErr"}) "Execution error" nil "e1"))))))

(deftest causes-message-test
  (is (= {:command/name "show-error-causes"
          :error/id "e1"
          :error/causes [{:class "java.lang.ArithmeticException" :message nil :stacktrace []}]}
         (sut/causes-message "e1" (clj->js [{:class "java.lang.ArithmeticException" :message [] :stacktrace []}])))
      "Gives the entry its causes as data"))
