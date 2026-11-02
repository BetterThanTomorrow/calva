(ns calva.repl.input.config
  "Reads what the REPL Inputs depend on from VS Code: the settings, the keys VS Code resolved for Calva's
   keybindings, the history, and the code of the latest evaluations."
  (:require
   [calva.repl.input.brackets :as brackets]
   [calva.repl.input.command-keys :as command-keys]
   [calva.repl.input.completion :as completion]
   [calva.util :as util]
   [clojure.set :as set]
   ["fs" :as fs]
   ["jsonc-parser" :as jsonc]
   ["path" :as path]))

(defn current-setting
  []
  (when-let [vscode @util/vscode]
    (js->clj (.. ^js vscode -workspace (getConfiguration "calva") (get "outputViews.replInput")))))

(def ^:private editing-settings
  {"editor.multiCursorModifier" :multi-cursor-modifier
   "editor.wordSeparators" :word-separators})

(def clojure-settings
  "The settings read for Clojure, since they can be set per language."
  (concat brackets/close-settings (keys editing-settings) completion/settings))

(defn editor-settings
  [settings]
  (merge (brackets/editor-settings settings)
         (set/rename-keys (select-keys settings (keys editing-settings)) editing-settings)
         {:completion (completion/editor-settings settings)}))

(defn read-settings
  "The settings that the parsed `keybindings`, the brackets and the editing depend on, as a map from setting
   keys to values."
  [keybindings]
  (let [workspace (.-workspace ^js @util/vscode)
        read (fn [^js config ks]
               (into {} (map (fn [k] [k (js->clj (.get config k))])) ks))]
    (merge (read (.getConfiguration workspace)
                 (concat (command-keys/setting-keys keybindings)
                         brackets/highlight-settings))
           (read (.getConfiguration workspace js/undefined #js {:languageId "clojure"})
                 clojure-settings))))

(def ^:private resolved-keybindings-uri "vscode://defaultsettings/keybindings.json")

(defn- platform
  []
  (case js/process.platform
    "darwin" "mac"
    "win32" "win"
    "linux"))

(defn- read-resolved-keybindings+
  []
  (let [^js vscode @util/vscode]
    (-> (.. vscode -workspace (openTextDocument (.. vscode -Uri (parse resolved-keybindings-uri))))
        (.then (fn [^js doc]
                 (js->clj (jsonc/parse (.getText doc)) :keywordize-keys true))))))

(defn keybindings-path
  "Returns the path of the user's keybindings.json in the `user-dir` folder, for the profile that `storage`,
   VS Code's storage.json, associates with the workspace `workspace-key`. The default profile's file when
   there is no such profile, or it uses the default profile's keybindings."
  [user-dir storage workspace-key]
  (let [location (get-in storage ["profileAssociations" "workspaces" workspace-key])
        profile (some #(when (= location (get % "location")) %) (get storage "userDataProfiles"))]
    (if (and profile (not (get-in profile ["useDefaultFlags" "keybindings"])))
      (path/join user-dir "profiles" location "keybindings.json")
      (path/join user-dir "keybindings.json"))))

(defn- read-jsonc+
  "Returns a promise of the JSONC file at `file-path` as Clojure data, or of nil when it can't be read."
  [file-path]
  (-> (.readFile (.-promises fs) file-path "utf8")
      (.then #(js->clj (jsonc/parse %)))
      (.catch (constantly nil))))

(defn- workspace-key
  "The workspace's URI as VS Code's storage.json keys it: the workspace file's, or the folder's."
  []
  (let [^js workspace (.-workspace ^js @util/vscode)
        ^js folder (some-> (.-workspaceFolders workspace) first)]
    (str (or (.-workspaceFile workspace)
             (some-> folder .-uri)))))

(defn- read-user-keybindings+
  "Returns a promise of the entries of the user's keybindings.json, or of none when it can't be read. The
   user's folder is two levels up from Calva's global storage, which is the default profile's."
  [^js vscode-context]
  (let [user-dir (path/resolve (.. vscode-context -globalStorageUri -fsPath) ".." "..")]
    (-> (read-jsonc+ (path/join user-dir "globalStorage" "storage.json"))
        (.then #(read-jsonc+ (keybindings-path user-dir % (workspace-key))))
        (.then #(if (sequential? %) (mapv (fn [entry] (update-keys entry keyword)) %) [])))))

(defn- read-default-keybindings+
  "Returns a promise of the keys VS Code resolved for Calva's `manifest` keybindings with the current keyboard
   layout, or of the manifest's keys for the platform when those can't be read."
  [manifest]
  (let [fallback #(command-keys/platform-keybindings manifest (platform))]
    (-> (read-resolved-keybindings+)
        (.then (fn [resolved]
                 (let [keybindings (command-keys/calva-keybindings manifest resolved)]
                   (if (seq keybindings) keybindings (fallback)))))
        (.catch fallback))))

(defn read-keybindings+
  "Returns a promise of Calva's keybindings with the user's own keybindings of Calva's commands applied."
  [^js vscode-context]
  (let [manifest (js->clj (.. vscode-context -extension -packageJSON -contributes -keybindings) :keywordize-keys true)]
    (-> (js/Promise.all #js [(read-default-keybindings+ manifest) (read-user-keybindings+ vscode-context)])
        (.then (fn [[defaults user]]
                 (command-keys/with-user-keybindings defaults (set (map :command manifest)) user))))))

(def history-key "calva.replInput.history")

(defn history
  "Returns the history as `workspaceState` keeps it."
  []
  (when-let [vscode-context @util/vscode-context]
    (js->clj (.. ^js vscode-context -workspaceState (get history-key #js [])) :keywordize-keys true)))

(defn store-history!
  [stored]
  (some-> ^js @util/vscode-context .-workspaceState (.update history-key (clj->js stored))))

(def evaluated-code-key "calva.replInput.evaluatedCode")

(defn evaluated-code
  "Returns the code the latest REPL Input evaluations kept, as `workspaceState` keeps it."
  []
  (when-let [vscode-context @util/vscode-context]
    (js->clj (.. ^js vscode-context -workspaceState (get evaluated-code-key #js [])) :keywordize-keys true)))

(defn store-evaluated-code!
  [stored]
  (some-> ^js @util/vscode-context .-workspaceState (.update evaluated-code-key (clj->js stored))))
