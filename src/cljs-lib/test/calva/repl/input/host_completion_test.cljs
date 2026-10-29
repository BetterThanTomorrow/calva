(ns calva.repl.input.host-completion-test
  (:require
   [calva.repl.input.host :as host]
   [calva.repl.input.host-fixtures :refer [mount-focused! post! posted-named with-fresh-host with-view]]
   [cljs.test :refer-macros [async deftest testing is]]))

(def pirate-core
  #js {:ns "pirate.core"
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

(def upper-case-lsp #js {:label "string/upper-case" :kind 3 :detail "clojure.string/upper-case"})

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
            (testing "asks clojure-lsp at the cursor's place in the copy of the followed file and the REPL Input"
              (is (= [{:uri "file:///pirate/src/pirate/core.clj"
                       :text "(ns pirate.core\n  (:require [clojure.string :as string]))\n\n(string/upp)"
                       :line 3
                       :character 11}]
                     (mapv #(select-keys % [:uri :text :line :character]) (calls completions :lsp)))))
            ((:resolve (first (calls completions :repl))) #js [upper-case-repl])
            (after-promises
             (fn []
               (testing "posts the REPL's candidates before clojure-lsp answers"
                 (is (= [{:repl-input.completion/request 1
                          :repl-input.completion/options [{:label "string/upper-case" :type "function" :index 0}]
                          :repl-input.completion/final? false}]
                        (answers posted))))
               (post! {:command "repl-input-complete" :repl-input/id "output-view" :request 2 :text "(string/uppe)" :offset 12})
               (testing "a new request cancels the one in flight"
                 (is (= ["(ns pirate.core\n  (:require [clojure.string :as string]))\n\n(string/upp)"]
                        (mapv :text (calls completions :cancel)))))
               ((:resolve (first (calls completions :lsp))) #js [upper-case-lsp])
               ((:resolve (second (calls completions :lsp))) #js [upper-case-lsp])
               ((:resolve (second (calls completions :repl))) #js [upper-case-repl])
               (after-promises
                (fn []
                  (testing "drops the answer to the cancelled request, and posts both sources, merged, for the new one"
                    (is (= [{:repl-input.completion/request 2
                             :repl-input.completion/options [{:label "string/upper-case" :type "function" :detail "clojure.string/upper-case" :index 0}
                                                             {:label "string/upper-case" :type "function" :index 1}]
                             :repl-input.completion/final? true}]
                           (rest (answers posted)))))
                  (done)))))))))))

(deftest complete-without-repl-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted completions session-keys] :as host}]
        (with-view host
          (fn []
            (reset! session-keys [])
            (mount-focused! "output-view" "(string/upp)")
            (host/editor-moved! pirate-core #js {})
            (post! {:command "repl-input-complete" :repl-input/id "output-view" :request 1 :text "(string/upp)" :offset 11})
            (testing "without a REPL, asks only clojure-lsp"
              (is (empty? (calls completions :repl))))
            (after-promises
             (fn []
               (testing "posts nothing before clojure-lsp answers, since the REPL has no candidates"
                 (is (empty? (answers posted))))
               ((:resolve (first (calls completions :lsp))) #js [upper-case-lsp])
               (after-promises
                (fn []
                  (testing "posts clojure-lsp's candidates alone"
                    (is (= [{:repl-input.completion/request 1
                             :repl-input.completion/options [{:label "string/upper-case" :type "function" :detail "clojure.string/upper-case" :index 0}]
                             :repl-input.completion/final? true}]
                           (answers posted))))
                  (done)))))))))))

(defn- answered!
  "Completes `request` with both sources' items, and calls `f` when it is answered."
  [completions request f]
  (post! {:command "repl-input-complete" :repl-input/id "output-view" :request request :text "(string/upp)" :offset 11})
  (doseq [{:keys [source resolve]} @completions]
    (resolve (if (= :repl source) #js [upper-case-repl] #js [upper-case-lsp])))
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
                         (post! {:command "repl-input-resolve-completion" :repl-input/id "output-view" :request 2 :index 1})
                         (post! {:command "repl-input-resolve-completion" :repl-input/id "output-view" :request 2 :index 0})
                         (post! {:command "repl-input-resolve-completion" :repl-input/id "output-view" :request 1 :index 0})
                         (after-promises
                          (fn []
                            (testing "resolves the docs of a REPL candidate and of a clojure-lsp candidate, and none for an older request"
                              (is (= #{{:repl-input.completion/request 2 :repl-input.completion/index 1
                                        :repl-input.completion/detail "pirate.core in clj"
                                        :repl-input.completion/documentation "REPL docs for string/upper-case"}
                                       {:repl-input.completion/request 2 :repl-input.completion/index 0
                                        :repl-input.completion/detail "lsp"
                                        :repl-input.completion/documentation "LSP docs for string/upper-case"}
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
                                                               :repl-input.context/source-file "file:///pirate/src/pirate/ui.cljs"})
            (post! {:command "repl-input-complete" :repl-input/id "output-view" :request 1 :text "(render)" :offset 7})
            (testing "a locked context completes in its namespace and session, below its `ns` form"
              (is (= [["pirate.ui" "cljs"]] (mapv (juxt :ns :session-key) (calls completions :repl))))
              (is (= [["(in-ns 'pirate.ui)\n(render)" 1 7]] (mapv (juxt :text :line :character) (calls completions :lsp)))))
            (post! {:command "repl-input-complete" :repl-input/id "output-view" :request 2 :text ";; ren" :offset 6})
            (after-promises
             (fn []
               (testing "as you type in a comment, `editor.quickSuggestions` leaves the list closed"
                 (is (= 1 (count (calls completions :lsp))))
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
