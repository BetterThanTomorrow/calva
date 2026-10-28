(ns tests.output-view-test
  (:require [cljs.test :refer [is testing]]
            [promesa.core :as p]
            ["vscode" :as vscode]
            [macros :refer [deftest-async]]))

;; Calva reads this document when a REPL Input in an Output view has mounted, which is the extension
;; host's side of the webview's `repl-input-mounted` message.
(def ^:private resolved-keybindings-uri "vscode://defaultsettings/keybindings.json")

(defn- wait-for+
  "Resolves with the value of `f` once it is truthy, and rejects when `timeout-ms` passed before that."
  [what timeout-ms f]
  (let [started (js/Date.now)]
    (p/create
     (fn [resolve reject]
       (letfn [(check []
                 (if-let [v (f)]
                   (resolve v)
                   (if (< timeout-ms (- (js/Date.now) started))
                     (reject (js/Error. (str "Timed out waiting for " what)))
                     (js/setTimeout check 100))))]
         (check))))))

(defn- output-view-tab
  []
  (->> (.-all vscode/window.tabGroups)
       (mapcat #(.-tabs %))
       (some #(when (some-> % .-input .-viewType (.includes "calva.output-view")) %))))

(defn- keybindings-read?
  []
  (some #(= resolved-keybindings-uri (str (.-uri %))) vscode/workspace.textDocuments))

(defn- set-repl-input+
  [setting]
  (.update (vscode/workspace.getConfiguration "calva") "outputViews.replInput" setting
           vscode/ConfigurationTarget.Global))

(defn- open-output-view+
  []
  (p/do (vscode/commands.executeCommand "calva.showReplOutputView")
        (wait-for+ "the Output View tab" 10000 output-view-tab)))

(defn- close-output-view+
  []
  (p/do (some-> (output-view-tab) vscode/window.tabGroups.close)
        (wait-for+ "the Output View to close" 10000 #(not (output-view-tab)))))

(deftest-async output-view-repl-input
  (let [!mounted? (atom false)
        listener (vscode/workspace.onDidOpenTextDocument
                  #(when (= resolved-keybindings-uri (str (.-uri %)))
                     (reset! !mounted? true)))]
    (-> (p/do
          (set-repl-input+ #js {"output-view" false "output-sidebar" false})
          (p/let [tab (open-output-view+)]
            (testing "With the REPL Input off"
              (is (= "REPL Output" (.-label tab))
                  "The Output View opens")))
          (close-output-view+)
          (is (not (or @!mounted? (keybindings-read?)))
              "No REPL Input mounted while it is off")
          (set-repl-input+ #js {"output-view" true "output-sidebar" false})
          (p/let [tab (open-output-view+)
                  mounted? (wait-for+ "the REPL Input to mount" 30000 #(deref !mounted?))]
            (testing "With the REPL Input on"
              (is (= "REPL" (.-label tab))
                  "The Output View opens")
              (is mounted?
                  "The REPL Input mounts in the Output View"))))
        (p/finally (fn []
                     (.dispose listener)
                     (p/do (close-output-view+)
                           (set-repl-input+ js/undefined)))))))
