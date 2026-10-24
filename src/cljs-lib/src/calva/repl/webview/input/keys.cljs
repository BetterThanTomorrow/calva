(ns calva.repl.webview.input.keys
  "Which keydowns in the REPL Input to leave to VS Code, matched against the keys VS Code binds Calva's
   commands to."
  (:require
   [clojure.string :as string]))

(def ^:private modifier-order ["ctrl" "shift" "alt" "meta"])

(def ^:private modifier-names
  {"ctrl" "ctrl" "shift" "shift" "alt" "alt" "option" "alt" "cmd" "meta" "meta" "meta" "win" "meta" "super" "meta"})

(defn- id-of
  [modifiers base]
  (string/join "+" (concat (filter modifiers modifier-order) [base])))

(defn key-id
  "Returns `k`, a key as VS Code's keybindings write it, in lower case and with its modifiers in one order."
  [k]
  (let [parts (string/split (string/lower-case k) #"\+")]
    (id-of (set (keep modifier-names (butlast parts))) (last parts))))

(defn command-keys
  "Returns the extension's `{:keys :chords}` with each key as a `key-id`."
  [command-keys]
  (update-vals command-keys #(into #{} (map key-id) %)))

(def ^:private named-keys
  {"ArrowLeft" "left" "ArrowRight" "right" "ArrowUp" "up" "ArrowDown" "down"
   "Backspace" "backspace" "Delete" "delete" "Enter" "enter" "Tab" "tab" "Escape" "escape"
   "Home" "home" "End" "end" "PageUp" "pageup" "PageDown" "pagedown" "Insert" "insert" " " "space"})

(def ^:private us-code-keys
  {"Backquote" "`" "Minus" "-" "Equal" "=" "BracketLeft" "[" "BracketRight" "]" "Backslash" "\\"
   "Semicolon" ";" "Quote" "'" "Comma" "," "Period" "." "Slash" "/"})

(defn- us-key
  [code]
  (or (get us-code-keys code)
      (some-> (re-matches #"Key([A-Z])" code) second string/lower-case)
      (second (re-matches #"Digit(\d)" code))))

(def ^:private modifier-key?
  #{"Control" "Shift" "Alt" "Meta" "AltGraph" "CapsLock" "Fn" "OS"})

(defn- event-key-ids
  "The ids a keydown `event` can have in VS Code's keybindings: by the key's name, by the character it
   types, and by its scan code. With Ctrl, Alt or Cmd held, also by its place on a US keyboard."
  [{:keys [key code ctrl? shift? alt? meta?]}]
  (let [modifiers (cond-> #{}
                    ctrl? (conj "ctrl")
                    shift? (conj "shift")
                    alt? (conj "alt")
                    meta? (conj "meta"))]
    (into #{}
          (comp (remove nil?)
                (map #(id-of modifiers %)))
          [(get named-keys key)
           (when (re-matches #"F\d+" key) (string/lower-case key))
           (when (= 1 (count key)) (string/lower-case key))
           (when (seq code) (str "[" (string/lower-case code) "]"))
           (when (or ctrl? alt? meta?) (us-key code))])))

(defn keydown
  "Returns `{:cancel? :pending-chord?}` for a keydown `event` in the REPL Input. `:cancel?` when the key
   is left to VS Code: one of `command-keys`, or the key after a chord's first key. `:pending-chord?`
   when VS Code waits for the rest of a chord after this key."
  [{:keys [keys chords]} pending-chord? {:keys [key composing?] :as event}]
  (cond
    (or composing? (modifier-key? key))
    {:cancel? false :pending-chord? pending-chord?}

    pending-chord?
    {:cancel? true :pending-chord? false}

    :else
    (let [ids (event-key-ids event)]
      {:cancel? (boolean (some keys ids))
       :pending-chord? (boolean (some chords ids))})))
