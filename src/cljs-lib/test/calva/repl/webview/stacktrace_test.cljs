(ns calva.repl.webview.stacktrace-test
  (:require
   [calva.repl.webview.stacktrace :as sut]
   [calva.repl.webview.stacktrace-fixtures :as fixtures]
   [cljs.test :refer-macros [deftest is]]))

(def runtime-causes (mapv sut/cause-data fixtures/runtime-chain))

(deftest cause-data
  (let [[outer _ root] runtime-causes
        [first-frame] (:stacktrace outer)]
    (is (= ["clojure.lang.ExceptionInfo" "clojure.lang.ExceptionInfo" "java.lang.NumberFormatException"]
           (map :class runtime-causes))
        "Keeps the causes, outermost first")
    (is (nil? (:phase outer))
        "bencode's empty list for nil becomes nil")
    (is (= #{"project" "clj"} (:flags first-frame))
        "Flags become a set")
    (is (nil? (:file-url (some #(when (contains? (:flags %) "repl") %) (:stacktrace outer))))
        "A frame without source gets a nil file-url")
    (is (= {} (:location outer))
        "An empty location map stays a map")
    (is (not-any? #(contains? % :id) runtime-causes)
        "The nREPL message id is dropped")
    (is (= "For input string: \"abc\"" (:message root)))))

(deftest error-entry
  (let [entry (sut/error-entry {:id "e1"
                                :error/text "Execution error"
                                :error/category "evalErr"
                                :error/causes runtime-causes})]
    (is (= "e1" (:error/id entry)))
    (is (false? (:error/unfolded? entry))
        "Starts folded")
    (is (= #{2} (:error/unfolded-causes entry))
        "The root cause shows its frames, the others have theirs folded")
    (is (true? (:error/unfolded? (sut/error-entry {:id "e2"
                                                   :error/causes runtime-causes
                                                   :error/unfolded? true})))
        "Can start unfolded")))

(deftest has-frames?
  (is (true? (sut/has-frames? runtime-causes)))
  (is (false? (sut/has-frames? [{:class "clojure.lang.ExceptionInfo" :stacktrace []}]))
      "A cause without frames, as from ClojureScript")
  (is (false? (sut/has-frames? nil))))

(deftest toggling
  (let [entry (sut/error-entry {:id "e1" :error/causes runtime-causes})]
    (is (true? (:error/unfolded? (sut/toggle-unfolded entry))))
    (is (false? (:error/unfolded? (-> entry sut/toggle-unfolded sut/toggle-unfolded))))
    (is (= #{0 2} (:error/unfolded-causes (sut/toggle-cause entry 0))))
    (is (= #{} (:error/unfolded-causes (sut/toggle-cause entry 2))))))

(deftest frame-parts
  (let [[clj-frame _ repl-frame java-frame] (:stacktrace (first runtime-causes))]
    (is (= {:frame/location "core.clj:16"
            :frame/qualifier "myproj.core"
            :frame/name "start!"
            :frame/file-url "file:/Users/me/myproj/src/myproj/core.clj"
            :frame/line 16}
           (sut/frame-parts clj-frame))
        "A Clojure frame shows its namespace and function, and links to its file")
    (is (= {:frame/location "Compiler.java:7757"
            :frame/qualifier "clojure.lang.Compiler"
            :frame/name "eval"
            :frame/file-url nil
            :frame/line 7757}
           (sut/frame-parts java-frame))
        "A Java frame shows its class and method")
    (is (nil? (:frame/file-url (sut/frame-parts repl-frame)))
        "A REPL frame has no file to open")))

(deftest cause-heading
  (let [[outer] runtime-causes]
    (is (= "clojure.lang.ExceptionInfo: Could not start" (sut/cause-heading outer)))
    (is (= "clojure.lang.ExceptionInfo: No message"
           (sut/cause-heading {:class "clojure.lang.ExceptionInfo" :message nil}))
        "A cause without a message says so")))
