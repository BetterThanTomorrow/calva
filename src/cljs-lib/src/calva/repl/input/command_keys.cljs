(ns calva.repl.input.command-keys
  "The keys Calva's keybindings own while a REPL Input has focus. The REPL Input leaves those keys
   to VS Code, so a Calva command runs instead of CodeMirror's own handling of the key."
  (:require
   [calva.repl.input.when-clause :as when-clause]
   [clojure.string :as string]))

(def user-keys-setting
  "The setting where the user lists the keys they bound to Calva commands in their own keybindings."
  "calva.outputViews.replInputCommandKeys")

(def ^:private context-settings
  {"calva:keybindingsEnabled" "calva.keybindingsEnabled"
   "paredit:keyMap" "calva.paredit.defaultKeyMap"})

(defn platform-keybindings
  "Returns the manifest's `keybindings` with the key for `platform` (`mac`, `win` or `linux`).
   For when VS Code's resolved keybindings can't be read."
  [keybindings platform]
  (keep (fn [binding]
          (when-let [k (or (get binding (keyword platform)) (:key binding))]
            (assoc binding :key k)))
        keybindings))

(defn calva-keybindings
  "Returns the entries of VS Code's resolved default keybindings that bind the commands the manifest's
   `keybindings` bind. Their keys are resolved for the keyboard layout."
  [keybindings resolved-keybindings]
  (let [commands (set (map :command keybindings))]
    (filterv (comp commands :command) resolved-keybindings)))

(defn parsed
  "Returns `keybindings` with their when clauses parsed."
  [keybindings]
  (mapv #(assoc % :when-clause/expr (when-clause/parse (:when %))) keybindings))

(defn setting-keys
  "The settings that the parsed `keybindings`' when clauses read, and the settings behind Calva's context keys."
  [keybindings]
  (into (set (vals context-settings))
        (comp (mapcat (comp when-clause/context-keys :when-clause/expr))
              (keep #(second (re-matches #"config\.(.+)" %))))
        keybindings))

(defn context
  "The context while the REPL Input of `record` has focus, under the `settings`, a map from setting keys to
   values, and while the REPL is `connected?`."
  [{:repl-input/keys [settings connected?]} {:repl-input/keys [cursor-contexts selections]}]
  (merge (update-keys settings #(str "config." %))
         (update-vals context-settings settings)
         cursor-contexts
         {"calva:replInputFocused" true
          "calva:connected" (boolean connected?)
          "editorHasMultipleSelections" (< 1 (count selections))}))

(defn command-keys
  "Returns `{:keys :chords}`. `:keys` has the first key of each of the parsed `keybindings` that hold in
   `context`, and of each of the `user-keys`. `:chords` has the ones of those that start a chord."
  [keybindings context user-keys]
  (let [held (concat (keep (fn [{:keys [key] :when-clause/keys [expr]}]
                             (when (when-clause/holds? expr context) key))
                           keybindings)
                     user-keys)
        chords (map #(string/split (string/trim %) #"\s+") held)]
    {:keys (into #{} (map first) chords)
     :chords (into #{} (keep #(when (next %) (first %))) chords)}))
