(ns calva.repl.input.host-test
  (:require
   [calva.repl.input.command-keys :as command-keys]
   [calva.repl.input.host :as sut]
   [cljs.reader :as reader]
   [cljs.test :refer-macros [async deftest testing is]]
   [clojure.string :as string]))

(defn- fake-adapter [{:keys [contexts restored]}]
  #js {:setContext (fn [k v] (swap! contexts conj [k v]))
       :document (fn [text selections] #js {:text text :selections selections})
       :documentState (fn [^js doc] #js {:text (.-text doc) :selections (.-selections doc)})
       :cursorContexts (fn [^js doc] #js {"calva:cursorInComment" (string/starts-with? (.-text doc) ";")})
       :brackets (fn [^js doc ^js options] #js {:text (.-text doc) :colorCount (.-colorCount options)})
       :restoreEditorCursorContexts (fn [] @restored)})

(defn- fake-view [posted]
  #js {:webview #js {:postMessage (fn [s] (swap! posted conj (reader/read-string s)))}})

(defn- with-fresh-host [f]
  (let [host {:contexts (atom [])
              :restored (atom true)
              :posted (atom [])}]
    (reset! sut/!state sut/initial-state)
    (reset! sut/!adapter (fake-adapter host))
    (reset! sut/!views {})
    (f host)))

(def ^:private !view (atom nil))

(defn- post! [m]
  (sut/handle-message! @!view (clj->js m :keyword-fn #(subs (str %) 1))))

(defn- with-view [{:keys [posted]} f]
  (reset! !view (fake-view posted))
  (f))

(defn- posted-named [posted command-name]
  (filterv #(= command-name (:command/name %)) @posted))

(deftest handle-message!-records-test
  (with-fresh-host
    (fn [host]
      (with-view host
        (fn []
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "" :selections [[0 0]]})
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 2 :text "(+ 1 2)" :selections [[7 7]]})
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 1 :text "(+ 1" :selections [[4 4]]})
          (testing "keeps the newest change for the REPL Input"
            (is (= {:repl-input/id "output-view" :repl-input/version 2 :repl-input/text "(+ 1 2)" :repl-input/selections [[7 7]]}
                   (select-keys (get-in @sut/!state [:repl-input/records "output-view"])
                                [:repl-input/id :repl-input/version :repl-input/text :repl-input/selections]))))
          (post! {:command "repl-input-unmounted" :repl-input/id "output-view"})
          (testing "drops the record when the REPL Input unmounts"
            (is (= {} (:repl-input/records @sut/!state)))))))))

(deftest handle-message!-focus-test
  (with-fresh-host
    (fn [{:keys [contexts] :as host}]
      (with-view host
        (fn []
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
            (is (not (sut/focused?)))))))))

(deftest view-lifecycle-focus-test
  (with-fresh-host
    (fn [{:keys [contexts] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (sut/view-hidden! "output-view")
          (testing "clears the context when the view is hidden"
            (is (= ["calva:replInputFocused" false] (last @contexts))))
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (sut/view-disposed! "output-view")
          (testing "clears the context when the view is disposed"
            (is (= ["calva:replInputFocused" false] (last @contexts)))
            (is (= 4 (count @contexts)))))))))

(deftest cursor-contexts-test
  (with-fresh-host
    (fn [{:keys [contexts restored] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "; a" :selections [[3 3]]})
          (testing "leaves the cursor contexts to the text editor while the REPL Input does not have focus"
            (is (= [] @contexts)))
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (testing "sets the cursor contexts from the REPL Input's document when it gets focus"
            (is (= #{["calva:replInputFocused" true] ["calva:cursorInComment" true]} (set @contexts))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 1 :text "; ab" :selections [[4 4]]})
          (testing "sets only the contexts that change"
            (is (= 2 (count @contexts))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 2 :text "a" :selections [[1 1]]})
          (testing "follows the REPL Input's cursor"
            (is (= ["calva:cursorInComment" false] (last @contexts))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 3 :text "; a" :selections [[3 3]]})
          (reset! restored false)
          (sut/text-editor-focused!)
          (testing "clears the cursor contexts it set when no text editor takes them back"
            (is (= ["calva:cursorInComment" false] (last @contexts))))
          (post! {:command "repl-input-focused" :repl-input/id "output-view"})
          (reset! contexts [])
          (reset! restored true)
          (post! {:command "repl-input-blurred" :repl-input/id "output-view"})
          (testing "leaves the cursor contexts to the text editor that takes them back"
            (is (= [["calva:replInputFocused" false]] @contexts))))))))

(deftest command-keys-test
  (with-fresh-host
    (fn [{:keys [posted] :as host}]
      (with-view host
        (fn []
          (swap! sut/!state assoc
                 :repl-input/keybindings (command-keys/parsed [{:command "calva.replInput.deleteBackward"
                                                                :key "backspace"
                                                                :when "calva:replInputFocused && !calva:cursorInComment"}])
                 :repl-input/settings {command-keys/user-keys-setting ["ctrl+j"]})
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "" :selections [[0 0]]})
          (testing "posts the command keys to the REPL Input when it mounts"
            (is (= [{:command/name "repl-input-command-keys"
                     :repl-input/id "output-view"
                     :repl-input/version 0
                     :repl-input/command-keys {:keys #{"backspace" "ctrl+j"} :chords #{}}}]
                   (posted-named posted "repl-input-command-keys"))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 1 :text "a" :selections [[1 1]]})
          (testing "posts nothing when the keys stay the same"
            (is (= 1 (count (posted-named posted "repl-input-command-keys")))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 2 :text "; a" :selections [[3 3]]})
          (testing "posts the keys when the REPL Input's cursor contexts change them"
            (is (= {:keys #{"ctrl+j"} :chords #{}}
                   (:repl-input/command-keys (last (posted-named posted "repl-input-command-keys"))))))
          (sut/settings-changed! {command-keys/user-keys-setting []})
          (testing "posts the keys when the settings change them"
            (is (= {:keys #{} :chords #{}}
                   (:repl-input/command-keys (last (posted-named posted "repl-input-command-keys")))))))))))

(deftest edit-focused!-test
  (async done
    (with-fresh-host
      (fn [{:keys [posted] :as host}]
        (with-view host
          (fn []
            (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "(a)" :selections [[2 2]]})
            (post! {:command "repl-input-focused" :repl-input/id "output-view"})
            (-> (sut/edit-focused! (fn [^js doc]
                                     (set! (.-text doc) "(a b)")
                                     (set! (.-selections doc) #js [#js [4 4]])))
                (.then (fn [_]
                         (testing "posts what the command made of the focused REPL Input's document, for the version it ran on"
                           (is (= [{:command/name "repl-input-edit"
                                    :repl-input/id "output-view"
                                    :repl-input/version 0
                                    :text "(a b)"
                                    :selections [[4 4]]}]
                                  (posted-named posted "repl-input-edit"))))
                         (testing "the record expects the edited version"
                           (is (= [1 "(a b)"]
                                  ((juxt :repl-input/version :repl-input/text)
                                   (get-in @sut/!state [:repl-input/records "output-view"])))))
                         (sut/edit-focused! (fn [^js doc]
                                              (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 2 :text "(a b c)" :selections [[6 6]]})
                                              (set! (.-text doc) "(a b d)")))))
                (.then (fn [_]
                         (testing "drops the edit when the REPL Input changed while the command ran"
                           (is (= 1 (count (posted-named posted "repl-input-edit"))))
                           (is (= "(a b c)" (get-in @sut/!state [:repl-input/records "output-view" :repl-input/text]))))
                         (sut/edit-focused! (fn [_]))))
                (.then (fn [_]
                         (testing "posts nothing when the command changed nothing"
                           (is (= 1 (count (posted-named posted "repl-input-edit")))))
                         (done))))))))))

(deftest brackets-test
  (with-fresh-host
    (fn [{:keys [posted] :as host}]
      (with-view host
        (fn []
          (post! {:command "repl-input-mounted" :repl-input/id "output-view" :version 0 :text "(a)" :selections [[3 3]]})
          (testing "posts the brackets of the REPL Input's text, for its version, when it mounts"
            (is (= [{:command/name "repl-input-brackets"
                     :repl-input/id "output-view"
                     :repl-input/version 0
                     :repl-input/brackets {:text "(a)" :colorCount 1}}]
                   (posted-named posted "repl-input-brackets"))))
          (testing "posts the closing brackets and the bracket styles when it mounts"
            (is (= [["(" "[" "{" "\""]]
                   (map (comp :close-brackets :repl-input/editor-settings)
                        (posted-named posted "repl-input-editor-settings")))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 1 :text "(a)" :selections [[0 0]]})
          (testing "posts nothing when the brackets stay the same"
            (is (= 1 (count (posted-named posted "repl-input-brackets")))))
          (post! {:command "repl-input-changed" :repl-input/id "output-view" :version 2 :text "(a b)" :selections [[5 5]]})
          (testing "posts the brackets when the text changes"
            (is (= [2 {:text "(a b)" :colorCount 1}]
                   ((juxt :repl-input/version :repl-input/brackets) (last (posted-named posted "repl-input-brackets"))))))
          (sut/settings-changed! {"editor.autoClosingBrackets" "never"
                                  "calva.highlight.bracketColors" ["#111" "#222"]})
          (testing "posts the brackets and the editor settings when the settings change them"
            (is (= 2 (:colorCount (:repl-input/brackets (last (posted-named posted "repl-input-brackets"))))))
            (is (= ["\""]
                   (:close-brackets (:repl-input/editor-settings (last (posted-named posted "repl-input-editor-settings"))))))))))))
