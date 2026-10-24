(ns calva.repl.webview.input.commands-test
  (:require
   [calva.repl.webview.input.commands :as sut]
   [calva.repl.webview.input.keys :as input-keys]
   [cljs.test :refer-macros [deftest testing is]]
   [clojure.string :as string]
   ["@codemirror/commands" :refer [history]]
   ["@codemirror/state" :refer [EditorSelection EditorState]]))

(def ^:private cm-modifiers
  {"Mod" :meta? "Cmd" :meta? "Meta" :meta? "Ctrl" :ctrl? "Alt" :alt? "Shift" :shift?})

(defn- mac-keydown
  "The keydown a CodeMirror key name, like `Shift-Alt-ArrowLeft`, gives on a Mac."
  [cm-key]
  (let [parts (string/split cm-key #"-")
        base (last parts)]
    (merge {:key base
            :code (if (re-matches #"[a-zA-Z]" base) (str "Key" (string/upper-case base)) base)
            :ctrl? false :shift? false :alt? false :meta? false}
           (zipmap (map cm-modifiers (butlast parts)) (repeat true)))))

(def ^:private mac-keydowns
  "The keydowns the REPL Input's CodeMirror keymap binds on a Mac."
  (for [^js binding sut/keymap
        :let [k (or (.-mac binding) (.-key binding))]
        :when k
        cm-key (cond-> [k] (.-shift binding) (conj (str "Shift-" k)))]
    (mac-keydown cm-key)))

(defn- left-to-vscode
  "The keydowns of the keymap that the REPL Input leaves to VS Code with `keys` in its cancel list."
  [keys]
  (let [command-keys (input-keys/command-keys {:keys keys :chords #{}})]
    (set (filter #(:cancel? (input-keys/keydown command-keys false %)) mac-keydowns))))

(defn- binds?
  [k]
  (seq (left-to-vscode #{k})))

(def ^:private vscode-editing-keys
  "The macOS keys of VS Code's editing commands that the REPL Input runs as commands of its own."
  #{"cmd+z" "shift+cmd+z" "cmd+u" "cmd+d" "shift+cmd+l" "alt+cmd+up" "alt+cmd+down" "shift+alt+i"
    "cmd+/" "alt+up" "alt+down" "shift+alt+up" "shift+alt+down" "shift+cmd+k" "cmd+enter"
    "shift+cmd+enter" "cmd+]" "cmd+[" "ctrl+j" "ctrl+shift+cmd+right" "ctrl+shift+cmd+left"
    "ctrl+shift+right" "ctrl+shift+left"})

(deftest keymap-test
  (testing "binds none of the keys the REPL Input's own commands have, so those keys reach VS Code's keybindings"
    (is (= #{} (left-to-vscode vscode-editing-keys))))
  (testing "moves and selects at every cursor with the arrows, home, end and the page keys"
    (is (every? binds? ["left" "shift+right" "alt+left" "shift+alt+right" "cmd+left" "shift+cmd+right"
                        "up" "shift+down" "cmd+up" "home" "shift+end" "pageup" "cmd+a"])))
  (testing "has the macOS ctrl keys that VS Code has, and leaves out the ones VS Code doesn't bind"
    (is (every? binds? ["ctrl+a" "ctrl+e" "ctrl+f" "ctrl+b" "ctrl+n" "ctrl+p" "ctrl+d" "ctrl+h" "ctrl+k" "ctrl+o" "ctrl+t"]))
    (is (not-any? binds? ["ctrl+v" "ctrl+alt+h" "ctrl+up" "ctrl+down"])))
  (testing "leaves the clipboard keys to VS Code's clipboard commands and cmd+f to the view's find"
    (is (not-any? binds? ["cmd+c" "cmd+v" "cmd+x" "cmd+f"])))
  (testing "escape closes the completion list, then removes the extra cursors"
    (is (= ["closeCompletion" "simplifySelection"]
           (for [^js binding sut/keymap
                 :when (= "Escape" (.-key binding))]
             (.. binding -run -name)))))
  (testing "a key that a Calva command owns, like alt+right for forward sexp, reaches VS Code before the keymap"
    (is (= #{"ArrowRight"} (set (map :key (left-to-vscode #{"alt+right"})))))
    (is (seq (left-to-vscode #{"ctrl+k"})))))

(deftest word-chars-test
  (testing "counts the punctuation that isn't a word separator as part of a word"
    (let [chars (set (sut/word-chars "()[]{}\""))]
      (is (every? chars ["-" "?" "!" "*" "/" "."]))
      (is (not-any? chars ["(" ")" "[" "]" "{" "}" "\""])))))

(def ^:private one {:ranges [[1 1]] :main 0})
(def ^:private two {:ranges [[2 2]] :main 0})

(deftest next-cursor-history-test
  (testing "a selection change keeps the selection from before it"
    (is (= [one] (sut/next-cursor-history [] {:before one :after two}))))
  (testing "keeps a selection once, when it is the last one kept"
    (is (= [one] (sut/next-cursor-history [one] {:before one :after two}))))
  (testing "keeps nothing when the selection is unchanged"
    (is (= [] (sut/next-cursor-history [] {:before one :after one}))))
  (testing "cursor undo takes the last one"
    (is (= [one] (sut/next-cursor-history [one two] {:cursor-undo? true :before one :after two}))))
  (testing "a change of the text empties it"
    (is (= [] (sut/next-cursor-history [one two] {:doc-changed? true :before one :after two}))))
  (testing "keeps at most the limit"
    (let [history (vec (for [i (range sut/cursor-undo-limit)] {:ranges [[i i]] :main 0}))]
      (is (= (conj (subvec history 1) {:ranges [[99 99]] :main 0})
             (sut/next-cursor-history history {:before {:ranges [[99 99]] :main 0} :after one}))))))

(deftest line-end-cursors-test
  (testing "puts a cursor at the end of each line a selection covers, and at its end"
    (is (= [1 3 5] (sut/line-end-cursors "a\nb\ncd" [[0 5]]))))
  (testing "puts none on the line where a selection ends at its start"
    (is (= [1 3] (sut/line-end-cursors "a\nb\nc" [[0 4]]))))
  (testing "puts one at the end of a selection within a line"
    (is (= [2] (sut/line-end-cursors "abc" [[1 2]]))))
  (testing "puts none for an empty selection"
    (is (= [] (sut/line-end-cursors "a\nb" [[1 1]])))))

(deftest join-lines-test
  (testing "joins the cursor's line with the next, without its indentation, and puts the cursor where they joined"
    (is (= {:changes [{:from 0 :to 7 :insert "(a b)"}] :selections [[2 2]]}
           (sut/join-lines "(a\n  b)\n(c)" [[1 1]]))))
  (testing "joins the lines a selection covers, and selects up to where the last was joined"
    (is (= {:changes [{:from 0 :to 11 :insert "(a b c)"}] :selections [[0 4]]}
           (sut/join-lines "(a\n  b\n  c)" [[0 9]]))))
  (testing "keeps a selection within a line, moved by the joins before it"
    (is (= {:changes [{:from 0 :to 3 :insert "a b"} {:from 4 :to 9 :insert "cd e"}] :selections [[1 1] [4 6]]}
           (sut/join-lines "a\nb\ncd\n e" [[1 1] [4 6]]))))
  (testing "leaves out a cursor on lines another cursor joins"
    (is (= [[1 1]] (:selections (sut/join-lines "a\nb\nc" [[0 0] [2 2]])))))
  (testing "collapses the space at the end of the line into one"
    (is (= {:changes [{:from 0 :to 5 :insert "x y"}] :selections [[2 2]]}
           (sut/join-lines "x  \ny" [[0 0]]))))
  (testing "does nothing on the last line"
    (is (nil? (sut/join-lines "a\nb" [[3 3]])))))

(defn- run-command
  "Runs the command named `command-name` on `text` with the `[anchor head]` `selections`, or on the
   state of `target`. Returns the text and selections after it, and the target, for running more commands."
  ([command-name text selections]
   (let [extensions #js [(history) sut/extensions (sut/language-data "()[]{}")]
         state (.create EditorState
                        #js {:doc text
                             :selection (.create EditorSelection (into-array (for [[a h] selections] (.range EditorSelection a h))))
                             :extensions extensions})
         target #js {:state state}]
     (set! (.-dispatch target) (fn [^js transaction] (set! (.-state target) (.-state transaction))))
     (run-command command-name target)))
  ([command-name ^js target]
   ((get sut/by-name command-name) target)
   (let [^js state (.-state target)]
     {:text (.. state -doc toString)
      :selections (mapv (fn [^js r] [(.-anchor r) (.-head r)]) (.. state -selection -ranges))
      :target target})))

(deftest by-name-test
  (testing "has a command for every name"
    (is (every? fn? (vals sut/by-name))))
  (testing "cursor undo goes back to the cursors before the last cursor change"
    (let [{:keys [target]} (run-command "insertCursorAtEndOfEachLineSelected" "a\nb" [[0 3]])]
      (is (= [[0 3]] (:selections (run-command "cursorUndo" target))))))
  (testing "select highlights selects every occurrence of the word at the cursor"
    (is (= [[0 3] [8 11]] (:selections (run-command "selectHighlights" "foo bar foo" [[1 1]])))))
  (testing "comment line uses Clojure's line comment"
    (is (= ";; (a)\n;; (b)" (:text (run-command "commentLine" "(a)\n(b)" [[0 5]])))))
  (testing "join lines joins at every cursor"
    (is (= "a b\nc d" (:text (run-command "joinLines" "a\nb\nc\nd" [[0 0] [4 4]])))))
  (testing "delete left and right delete one character at every cursor, also a bracket"
    (is (= {:text "(((a))\n(b" :selections [[6 6] [9 9]]}
           (select-keys (run-command "deleteLeft" "(((a)))\n(b)" [[7 7] [11 11]]) [:text :selections])))
    (is (= {:text "(((a))\nb)" :selections [[3 3] [7 7]]}
           (select-keys (run-command "deleteRight" "((((a))\n(b)" [[3 3] [8 8]]) [:text :selections]))))
  (testing "undo takes back the last change, and redo does it again"
    (let [{:keys [target]} (run-command "joinLines" "a\nb" [[0 0]])]
      (is (= "a b" (.. target -state -doc toString)))
      (is (= "a\nb" (:text (run-command "undo" target))))
      (is (= "a b" (:text (run-command "redo" target)))))))
