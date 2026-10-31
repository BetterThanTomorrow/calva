(ns calva.repl.input.printed-code-test
  (:require
   [calva.repl.input.command-keys :as command-keys]
   [calva.repl.input.host :as host]
   [calva.repl.input.host-fixtures :refer [post! posted-named with-fresh-host with-view]]
   [calva.repl.input.printed-code :as sut]
   [cljs.test :refer-macros [async deftest testing is]]))

(defn- context-values
  [contexts k]
  (mapv second (filter #(= k (first %)) @contexts)))

(defn- focus-printed-code!
  [id text selections]
  (post! {:command "printed-code-focused" :repl-input/id id :version 0 :text text :selections selections}))

(deftest focus-test
  (with-fresh-host
    (fn [{:keys [contexts] :as host}]
      (with-view host
        (fn []
          (focus-printed-code! "output-view" "; a" [[1 1]])
          (testing "sets its own context key and its cursor contexts when printed code gets focus"
            (is (= [true] (context-values contexts "calva:printedCodeFocused")))
            (is (= [true] (context-values contexts "calva:cursorInComment")))
            (is (= [] (context-values contexts "calva:replInputFocused")))
            (is (sut/focused?)))
          (testing "leaves evaluation to the REPL Inputs and the editors"
            (is (not (host/focused?))))
          (testing "registers the view, so the extension can post to it without a REPL Input"
            (is (contains? @host/!views "output-view")))
          (post! {:command "printed-code-blurred" :repl-input/id "output-view"})
          (testing "stays the last focused place when it loses the focus, as to the command palette"
            (is (= [true false] (context-values contexts "calva:printedCodeFocused")))
            (is (= [true] (context-values contexts "calva:printedCodeLastFocused")))
            (is (sut/focused?)))
          (focus-printed-code! "output-view" "; a" [[1 1]])
          (post! {:command "repl-input-focused" :repl-input/id "output-sidebar"})
          (testing "a REPL Input taking the focus ends it"
            (is (= [true false true false] (context-values contexts "calva:printedCodeFocused")))
            (is (not (sut/focused?)))
            (is (host/focused?)))
          (focus-printed-code! "output-view" "(a)" [[1 1]])
          (testing "it taking the focus ends the REPL Input's"
            (is (= [true false] (context-values contexts "calva:replInputFocused")))
            (is (= [true false] (context-values contexts "calva:replInputLastFocused")))
            (is (not (host/focused?))))
          (post! {:command "printed-code-unmounted" :repl-input/id "output-view"})
          (testing "drops the record and the focus when the editor goes"
            (is (= {} (:printed-code/records @host/!state)))
            (is (not (sut/focused?)))))))))

(deftest not-last-focused-test
  (with-fresh-host
    (fn [{:keys [posted] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-mounted" :repl-input/id "output-sidebar" :version 0 :text "" :selections [[0 0]]})
          (post! {:command "repl-input-focused" :repl-input/id "output-sidebar"})
          (focus-printed-code! "output-view" "(a)" [[1 1]])
          (testing "tells the other views when printed code becomes the last focused place"
            (is (= ["output-sidebar"] (mapv :repl-input/id (posted-named posted "repl-input-not-last-focused"))))))))))

(deftest changes-test
  (with-fresh-host
    (fn [host]
      (with-view host
        (fn []
          (focus-printed-code! "output-view" "(a b)" [[1 1]])
          (post! {:command "printed-code-changed" :repl-input/id "output-view" :version 2 :selections [[0 5]]})
          (post! {:command "printed-code-changed" :repl-input/id "output-view" :version 1 :selections [[3 3]]})
          (testing "keeps the newest selections, and the text"
            (is (= {:repl-input/version 2 :repl-input/text "(a b)" :repl-input/selections [[0 5]]}
                   (select-keys (get-in @host/!state [:printed-code/records "output-view"])
                                [:repl-input/version :repl-input/text :repl-input/selections])))))))))

(deftest command-keys-test
  (with-fresh-host
    (fn [{:keys [posted] :as host}]
      (with-view host
        (fn []
          (swap! host/!state assoc :repl-input/keybindings
                 (command-keys/parsed [{:command "paredit.forwardSexp"
                                        :key "ctrl+alt+right"
                                        :when "calva:replInputFocused || calva:printedCodeFocused"}
                                       {:command "paredit.slurpSexpForward"
                                        :key "ctrl+alt+."
                                        :when "calva:replInputFocused"}]))
          (focus-printed-code! "output-view" "(a)" [[1 1]])
          (testing "posts the keys of the commands that hold in printed code"
            (is (= [{:command/name "printed-code-command-keys"
                     :repl-input/id "output-view"
                     :repl-input/command-keys {:keys #{"ctrl+alt+right"} :chords #{}}}]
                   (posted-named posted "printed-code-command-keys")))))))))

(deftest select-focused!-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted] :as host}]
        (with-view host
          (fn []
            (focus-printed-code! "output-view" "(a b)" [[1 1]])
            (-> (sut/select-focused! (fn [^js doc] (set! (.-selections doc) #js [#js [0 5]])))
                (.then (fn [_]
                         (testing "posts the selections a command made, for the version it ran on"
                           (is (= [{:command/name "printed-code-selections"
                                    :repl-input/id "output-view"
                                    :version 0
                                    :selections [[0 5]]}]
                                  (posted-named posted "printed-code-selections")))
                           (is (= [1 [[0 5]]]
                                  ((juxt :repl-input/version :repl-input/selections)
                                   (get-in @host/!state [:printed-code/records "output-view"])))))
                         (sut/select-focused! (fn [^js doc]
                                                (set! (.-text doc) "(a b c)")
                                                (set! (.-selections doc) #js [#js [6 6]])))))
                (.then (fn [_]
                         (testing "drops what a command that changed the text made"
                           (is (= 1 (count (posted-named posted "printed-code-selections"))))
                           (is (= "(a b)" (get-in @host/!state [:printed-code/records "output-view" :repl-input/text]))))
                         (sut/select-focused! (fn [_]))))
                (.then (fn [_]
                         (testing "posts nothing when the command moved nothing"
                           (is (= 1 (count (posted-named posted "printed-code-selections")))))
                         (post! {:command "printed-code-blurred" :repl-input/id "output-view"})
                         (sut/select-focused! (fn [_]))))
                (.then (fn [_]
                         (testing "gives the focus back to the last focused printed code"
                           (is (= ["output-view"] (mapv :repl-input/id (posted-named posted "printed-code-focus")))))
                         (done))))))))))
