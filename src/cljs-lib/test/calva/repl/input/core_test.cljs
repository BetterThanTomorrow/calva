(ns calva.repl.input.core-test
  (:require
   [calva.repl.input.core :as sut]
   [calva.repl.input.host :as host]
   [calva.util :as util]
   [cljs.test :refer-macros [deftest testing is]]))

(defn- fake-vscode-context
  "A context whose `workspaceState` keeps `stored` for every key."
  [stored]
  #js {:workspaceState #js {:get (fn [_k _default] stored)}
       :subscriptions #js []})

(def ^:private fake-vscode
  #js {:workspace #js {:onDidChangeConfiguration (fn [_listener] #js {})}
       :window #js {:onDidChangeActiveTerminal (fn [_listener] #js {})}})

(deftest init!-test
  (testing "starts with no history and no evaluated code when workspaceState keeps something else than a list"
    (let [state-before @host/!state
          adapter-before @host/!adapter
          vscode-context (fake-vscode-context 5)]
      (try
        (with-redefs [util/vscode-context (atom vscode-context)
                      util/vscode (atom fake-vscode)]
          (sut/init! #js {})
          (is (= [] (:repl-input.history/entries @host/!state)))
          (is (= [] (:repl-input/evaluated-code @host/!state)))
          (is (= 2 (.-length (.-subscriptions vscode-context)))
              "Listens for setting changes and terminal focus"))
        (finally
          (reset! host/!state state-before)
          (reset! host/!adapter adapter-before))))))
