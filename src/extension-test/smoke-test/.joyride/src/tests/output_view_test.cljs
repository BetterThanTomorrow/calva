(ns tests.output-view-test
  (:require [cljs.test :refer [is testing]]
            [clojure.string :as string]
            [joyride.core :as joyride]
            [promesa.core :as p]
            ["fs" :as fs]
            ["path" :as path]
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

(defn- renderer-log-path
  "Returns the path of the window's renderer log, two folders up from Joyride's extension host log folder."
  []
  (path/join (path/dirname (path/dirname (.. (joyride/extension-context) -logUri -fsPath))) "renderer.log"))

(defn- renderer-log-entries
  "Returns the last `n` entries of the renderer log that are errors or mention webviews. An entry is a
   timestamped line and the lines that follow it, of which it keeps the first few."
  [n]
  (let [log-path (renderer-log-path)]
    (when (fs/existsSync log-path)
      (->> (string/split-lines (fs/readFileSync log-path "utf8"))
           (reduce (fn [entries line]
                     (if (or (empty? entries) (re-find #"^\d{4}-\d{2}-\d{2} " line))
                       (conj entries [line])
                       (update entries (dec (count entries)) conj line)))
                   [])
           (filter #(re-find #"(?i)webview|\[error\]" (string/join "\n" %)))
           (take-last n)
           (map #(string/join "\n" (take 6 %)))))))

(defn- print-mount-diagnosis!
  "Prints what the window shows when the REPL Input hasn't mounted: the Output View tab, the setting, whether
   the keybindings document is open, and the renderer log's webview and error entries."
  []
  (let [setting (.get (vscode/workspace.getConfiguration "calva") "outputViews.replInput")
        lines (concat [""
                       "The REPL Input didn't mount. What the window shows:"
                       (str "Output View tab: " (or (some-> (output-view-tab) .-label) "none"))
                       (str "calva.outputViews.replInput: " (js/JSON.stringify setting))
                       (str "Keybindings document open: " (boolean (keybindings-read?)))
                       (str "Webview and error entries in " (renderer-log-path) ":")]
                      (or (seq (renderer-log-entries 10)) ["(none)"])
                      [""])]
    (js/process.stdout.write (string/join "\n" lines))))

(defn- set-repl-input+
  "Sets the REPL Input setting, and resolves once the extension host reads the new value. That can be after
   the update has resolved, and Calva builds the Output View's page from the value it reads."
  [setting]
  (let [config #(vscode/workspace.getConfiguration "calva")
        expected (js->clj setting)]
    (p/do (.update (config) "outputViews.replInput" setting vscode/ConfigurationTarget.Global)
          (wait-for+ "the extension host to read the REPL Input setting" 10000
                     #(= expected (js->clj (.-globalValue (.inspect (config) "outputViews.replInput"))))))))

(defn- open-output-view+
  []
  (p/do (vscode/commands.executeCommand "calva.showReplOutputView")
        (wait-for+ "the Output View tab" 10000 output-view-tab)))

(defn- close-output-view+
  []
  (p/do (some-> (output-view-tab) vscode/window.tabGroups.close)
        (wait-for+ "the Output View to close" 10000 #(not (output-view-tab)))))

(def ^:private off-hold-ms
  "How long the test holds the Output View open with the REPL Input off before it checks that nothing
   mounted. With the REPL Input off, nothing the test can see tells that the page loaded."
  10000)

(deftest-async output-view-repl-input
  (let [!mounted? (atom false)
        listener (vscode/workspace.onDidOpenTextDocument
                  #(when (= resolved-keybindings-uri (str (.-uri %)))
                     (reset! !mounted? true)))]
    (-> (p/do
          (set-repl-input+ #js {"output-view" false "output-sidebar" false})
          (p/let [tab (open-output-view+)
                  _ (p/delay off-hold-ms)]
            (testing "With the REPL Input off"
              (is (= "REPL Output" (.-label tab))
                  "The Output View opens")
              (is (not (or @!mounted? (keybindings-read?)))
                  "No REPL Input mounts")))
          (close-output-view+)
          (set-repl-input+ #js {"output-view" true "output-sidebar" false})
          (p/let [tab (open-output-view+)
                  mounted? (-> (wait-for+ "the REPL Input to mount" 30000 #(deref !mounted?))
                               (p/catch (fn [error]
                                          (print-mount-diagnosis!)
                                          (p/rejected error))))]
            (testing "With the REPL Input on"
              (is (= "REPL" (.-label tab))
                  "The Output View opens")
              (is mounted?
                  "The REPL Input mounts in the Output View"))))
        (p/handle (fn [result error]
                    (.dispose listener)
                    (p/do (close-output-view+)
                          (set-repl-input+ js/undefined)
                          (if error (p/rejected error) result)))))))
