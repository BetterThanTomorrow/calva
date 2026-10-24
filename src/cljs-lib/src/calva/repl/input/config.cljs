(ns calva.repl.input.config
  "Reads what the REPL Inputs depend on from VS Code: the settings, the keys VS Code resolved for Calva's
   keybindings, and the REPL Inputs' heights."
  (:require
   [calva.repl.input.brackets :as brackets]
   [calva.repl.input.command-keys :as command-keys]
   [calva.util :as util]
   [clojure.set :as set]
   ["jsonc-parser" :as jsonc]))

(def heights-key "calva.replInput.heights")

(defn current-setting
  []
  (when-let [vscode @util/vscode]
    (js->clj (.. ^js vscode -workspace (getConfiguration "calva") (get "outputViews.replInput")))))

(def ^:private editing-settings
  {"editor.multiCursorModifier" :multi-cursor-modifier
   "editor.wordSeparators" :word-separators})

(def clojure-settings
  "The settings read for Clojure, since they can be set per language."
  (concat brackets/close-settings (keys editing-settings)))

(defn editor-settings
  [settings]
  (merge (brackets/editor-settings settings)
         (set/rename-keys (select-keys settings (keys editing-settings)) editing-settings)))

(defn read-settings
  "The settings that the parsed `keybindings`, the brackets and the editing depend on, as a map from
   setting keys to values."
  [keybindings]
  (let [workspace (.-workspace ^js @util/vscode)
        read (fn [^js config ks]
               (into {} (map (fn [k] [k (js->clj (.get config k))])) ks))]
    (merge (read (.getConfiguration workspace)
                 (concat (command-keys/setting-keys keybindings)
                         [command-keys/user-keys-setting]
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

(defn read-keybindings+
  "Returns a promise of the keys VS Code resolved for Calva's keybindings with the current keyboard
   layout, or of the manifest's keys for the platform when those can't be read."
  [^js vscode-context]
  (let [manifest (js->clj (.. vscode-context -extension -packageJSON -contributes -keybindings) :keywordize-keys true)
        fallback #(command-keys/platform-keybindings manifest (platform))]
    (-> (read-resolved-keybindings+)
        (.then (fn [resolved]
                 (let [keybindings (command-keys/calva-keybindings manifest resolved)]
                   (if (seq keybindings) keybindings (fallback)))))
        (.catch fallback))))

(defn heights
  []
  (when-let [vscode-context @util/vscode-context]
    (js->clj (.. ^js vscode-context -globalState (get heights-key)))))

(defn store-height!
  [{:keys [height] :repl-input/keys [id]}]
  (.. ^js @util/vscode-context -globalState (update heights-key (clj->js (assoc (heights) id height)))))
