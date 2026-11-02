(ns calva.repl.input.command-keys
  "The keys Calva's keybindings own while a REPL Input has focus. The REPL Input leaves those keys
   to VS Code, so a Calva command runs instead of CodeMirror's own handling of the key."
  (:require
   [calva.repl.input.when-clause :as when-clause]
   [calva.repl.webview.input.keys :as keys]
   [clojure.string :as string]))

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

(defn- chord-ids
  [k]
  (mapv keys/key-id (string/split (string/trim k) #"\s+")))

(defn- removes?
  "True when the user's keybinding `removal`, of `-<command>`, removes `binding`: every binding of the command,
   or the one with its key."
  [{removal-key :key removal-command :command} {:keys [key command]}]
  (and (= removal-command (str "-" command))
       (or (string/blank? removal-key)
           (= (chord-ids removal-key) (chord-ids key)))))

(defn with-user-keybindings
  "Returns Calva's `keybindings` with the user's `user-keybindings`, as keybindings.json has them, applied:
   the ones with a key for one of the `commands` added, and the ones a `-<command>` entry removes left out."
  [keybindings commands user-keybindings]
  (let [removals (filter #(string/starts-with? (str (:command %)) "-") user-keybindings)
        additions (filter #(and (commands (:command %)) (string? (:key %))) user-keybindings)]
    (into (filterv (fn [binding] (not-any? #(removes? % binding) removals)) keybindings)
          (map #(select-keys % [:key :command :when]))
          additions)))

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
  "The context while the REPL Input of `record` has focus, or the printed code of `record` with the
   `focused-context` `calva:printedCodeFocused`, under the `settings`, a map from setting keys to values,
   and while the REPL is `connected?`."
  ([state record]
   (context state record "calva:replInputFocused"))
  ([{:repl-input/keys [settings connected?]} {:repl-input/keys [cursor-contexts selections]} focused-context]
   (merge (update-keys settings #(str "config." %))
          (update-vals context-settings settings)
          cursor-contexts
          {focused-context true
           "calva:connected" (boolean connected?)
           "editorHasMultipleSelections" (< 1 (count selections))})))

(defn command-keys
  "Returns `{:keys :chords}`. `:keys` has the first key of each of the parsed `keybindings` that hold in
   `context`. `:chords` has the ones of those that start a chord."
  [keybindings context]
  (let [held (keep (fn [{:keys [key] :when-clause/keys [expr]}]
                     (when (when-clause/holds? expr context) key))
                   keybindings)
        chords (map #(string/split (string/trim %) #"\s+") held)]
    {:keys (into #{} (map first) chords)
     :chords (into #{} (keep #(when (next %) (first %))) chords)}))
