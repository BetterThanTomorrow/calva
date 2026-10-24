(ns calva.repl.input.host-completion-test
  (:require
   [calva.repl.input.host :as host]
   [calva.repl.input.host-fixtures :refer [mount-focused! post! posted-named with-fresh-host with-view]]
   [cljs.test :refer-macros [async deftest testing is]]))

(def pirate-core
  #js {:ns "pirate.core"
       :sessionKey "clj"
       :uri "file:///pirate/src/pirate/core.clj"
       :getText (fn [] "(ns pirate.core\n  (:require [clojure.string :as string]))\n")})

(defn- after-promises
  [f]
  (js/setTimeout f 0))

(defn- calls
  [completions source]
  (filterv #(= source (:source %)) @completions))

(defn- answers
  [posted]
  (mapv #(select-keys % [:repl-input.completion/request :repl-input.completion/options :repl-input.completion/final?])
        (posted-named posted "repl-input-completions")))

(def upper-case-repl #js {:label "string/upper-case" :kind 3 :data #js {:provider "repl"}})

(defn- resolved-docs
  [posted]
  (into #{} (map #(dissoc % :command/name :repl-input/id))
        (posted-named posted "repl-input-completion-docs")))

(deftest complete-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted completions] :as host}]
        (with-view host
          (fn []
            (mount-focused! "output-view" "(string/upp)")
            (host/editor-moved! pirate-core #js {})
            (post! {:command "repl-input-complete" :repl-input/id "output-view" :request 1 :text "(string/upp)" :offset 11})
            (testing "asks the REPL in the context's namespace and session"
              (is (= [{:session-key "clj" :ns "pirate.core" :text "(string/upp)" :offset 11}]
                     (mapv #(select-keys % [:session-key :ns :text :offset]) (calls completions :repl)))))
            (post! {:command "repl-input-complete" :repl-input/id "output-view" :request 2 :text "(string/uppe)" :offset 12})
            ((:resolve (first (calls completions :repl))) #js [upper-case-repl])
            ((:resolve (second (calls completions :repl))) #js [upper-case-repl])
            (after-promises
             (fn []
               (testing "drops the answer to the request a new request replaced, and posts the REPL's candidates for the new one"
                 (is (= [{:repl-input.completion/request 2
                          :repl-input.completion/options [{:label "string/upper-case" :type "function" :index 0}]
                          :repl-input.completion/final? true}]
                        (answers posted))))
               (done)))))))))

(defn- answered!
  "Completes `request` with the REPL's items, and calls `f` when it is answered."
  [completions request f]
  (post! {:command "repl-input-complete" :repl-input/id "output-view" :request request :text "(string/upp)" :offset 11})
  (doseq [{:keys [resolve]} @completions]
    (resolve #js [upper-case-repl]))
  (after-promises f))

(deftest resolve-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted completions] :as host}]
        (with-view host
          (fn []
            (mount-focused! "output-view" "(string/upp)")
            (host/editor-moved! pirate-core #js {})
            (answered! completions 2
                       (fn []
                         (post! {:command "repl-input-resolve-completion" :repl-input/id "output-view" :request 2 :index 0})
                         (post! {:command "repl-input-resolve-completion" :repl-input/id "output-view" :request 1 :index 0})
                         (after-promises
                          (fn []
                            (testing "resolves the docs of a REPL candidate, and none for an older request"
                              (is (= #{{:repl-input.completion/request 2 :repl-input.completion/index 0
                                        :repl-input.completion/detail "pirate.core in clj"
                                        :repl-input.completion/documentation "REPL docs for string/upper-case"}
                                       {:repl-input.completion/request 1 :repl-input.completion/index 0
                                        :repl-input.completion/detail nil
                                        :repl-input.completion/documentation nil}}
                                     (resolved-docs posted))))
                            (done)))))))))))

(deftest complete-locked-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted completions] :as host}]
        (with-view host
          (fn []
            (mount-focused! "output-view" "(render)")
            (host/editor-moved! pirate-core #js {})
            (swap! host/!state assoc :repl-input.context/lock {:repl-input.context/ns "pirate.ui"
                                                               :repl-input.context/ns-form "(in-ns 'pirate.ui)"
                                                               :repl-input.context/session-key "cljs"})
            (post! {:command "repl-input-complete" :repl-input/id "output-view" :request 1 :text "(render)" :offset 7})
            (testing "a locked context completes in its namespace and session"
              (is (= [["pirate.ui" "cljs"]] (mapv (juxt :ns :session-key) (calls completions :repl)))))
            (post! {:command "repl-input-complete" :repl-input/id "output-view" :request 2 :text ";; ren" :offset 6})
            (after-promises
             (fn []
               (testing "as you type in a comment, `editor.quickSuggestions` leaves the list closed"
                 (is (= 1 (count (calls completions :repl))))
                 (is (= [{:repl-input.completion/request 2 :repl-input.completion/options [] :repl-input.completion/final? true}]
                        (answers posted))))
               (done)))))))))

(deftest completion-active-test
  (with-fresh-host
    (fn [{:keys [contexts] :as host}]
      (with-view host
        (fn []
          (mount-focused! "output-view" "(str")
          (reset! contexts [])
          (post! {:command "repl-input-completion-active" :repl-input/id "output-view" :active? true})
          (testing "sets the completion contexts while the focused REPL Input's list is open"
            (is (= #{["calva:replInputCompletionActive" true] ["calva:replInputCompletionAcceptsEnter" true]}
                   (set @contexts))))
          (reset! contexts [])
          (post! {:command "repl-input-blurred" :repl-input/id "output-view"})
          (testing "clears them when the REPL Input loses focus"
            (is (= #{["calva:replInputCompletionActive" false] ["calva:replInputCompletionAcceptsEnter" false]}
                   (set (remove #(= "calva:replInputFocused" (first %)) @contexts))))))))))
