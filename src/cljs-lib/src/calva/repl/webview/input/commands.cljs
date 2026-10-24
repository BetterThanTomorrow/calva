(ns calva.repl.webview.input.commands
  "The REPL Input's editing in CodeMirror: the keys CodeMirror handles itself, and the commands that
   VS Code's keys run in it through Calva's keybindings."
  (:require
   [clojure.string :as string]
   ["@codemirror/autocomplete" :refer [closeCompletion]]
   ["@codemirror/commands" :refer [addCursorAbove addCursorBelow copyLineDown copyLineUp deleteLine
                                   indentLess indentMore moveLineDown moveLineUp redo simplifySelection
                                   standardKeymap toggleLineComment undo]]
   ["@codemirror/search" :refer [selectNextOccurrence selectSelectionMatches]]
   ["@codemirror/state" :refer [Annotation EditorSelection EditorState StateField]]))

(def ^:private mac-keys-vscode-leaves-unbound
  #{"Ctrl-v" "Ctrl-Alt-h" "Ctrl-ArrowUp" "Ctrl-ArrowDown"})

(def keymap
  "CodeMirror's standard keymap, which moves and selects at every cursor, without the macOS keys VS Code
   leaves unbound, and `escape`."
  (-> (.filter standardKeymap #(not (contains? mac-keys-vscode-leaves-unbound (.-mac ^js %))))
      (.concat #js [#js {:key "Escape" :run closeCompletion}
                    #js {:key "Escape" :run simplifySelection}])))

(def ^:private ascii-punctuation "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~")

(defn word-chars
  "The punctuation that CodeMirror counts as part of a word, when `separators` is `editor.wordSeparators`."
  [separators]
  (string/join (remove (set separators) ascii-punctuation)))

(defn language-data
  "CodeMirror's language data for the REPL Input: Clojure's line comment, and the word characters."
  [word-separators]
  (let [data #js {:commentTokens #js {:line ";;"}
                  :wordChars (word-chars word-separators)}]
    (.of (.-languageData EditorState) (fn [_ _ _] #js [data]))))

(def cursor-undo-limit 50)

(defn next-cursor-history
  "The selections that cursor undo can go back to after a transaction, kept the way VS Code keeps them:
   a change of the text empties them, cursor undo takes the last one, and a selection change adds the
   selections from before it."
  [history {:keys [doc-changed? cursor-undo? before after]}]
  (cond
    doc-changed? []
    cursor-undo? (pop history)
    (or (= before after) (= before (peek history))) history
    :else (vec (take-last cursor-undo-limit (conj history before)))))

(defn- selection-data
  [^js selection]
  {:ranges (mapv (fn [^js r] [(.-anchor r) (.-head r)]) (.-ranges selection))
   :main (.-mainIndex selection)})

(defn- editor-selection
  [{:keys [ranges main]}]
  (.create EditorSelection
           (into-array (for [[anchor head] ranges] (.range EditorSelection anchor head)))
           main))

(def ^:private cursor-undo-annotation (.define Annotation))

(def ^:private cursor-history
  (.define StateField
           #js {:create (fn [_] [])
                :update (fn [history ^js transaction]
                          (next-cursor-history history
                                               {:doc-changed? (.-docChanged transaction)
                                                :cursor-undo? (some? (.annotation transaction cursor-undo-annotation))
                                                :before (selection-data (.. transaction -startState -selection))
                                                :after (selection-data (.. transaction -state -selection))}))}))

(defn- update!
  [^js target spec]
  (.dispatch target (.update (.-state target) spec))
  true)

(defn- cursor-undo
  [^js target]
  (when-let [selection (peek (.. target -state (field cursor-history)))]
    (update! target #js {:selection (editor-selection selection)
                         :scrollIntoView true
                         :annotations (.of cursor-undo-annotation true)})))

(defn line-end-cursors
  "The cursors that VS Code's insertCursorAtEndOfEachLineSelected makes of the `[from to]` `ranges` in
   `text`: one at the end of each line a range covers, and on its last line one at the range's end,
   unless the range ends at the start of that line. Empty ranges give none."
  [text ranges]
  (into []
        (mapcat (fn [[from to]]
                  (when (< from to)
                    (cond-> (filterv #(= "\n" (nth text %)) (range from to))
                      (not= "\n" (nth text (dec to))) (conj to)))))
        ranges))

(defn- ranges
  [^js state]
  (mapv (fn [^js r] [(.-from r) (.-to r)]) (.. state -selection -ranges)))

(defn- insert-cursors-at-line-ends
  [^js target]
  (let [state (.-state target)]
    (when-let [cursors (seq (line-end-cursors (.. state -doc toString) (ranges state)))]
      (update! target #js {:selection (.create EditorSelection (into-array (map #(.cursor EditorSelection %) cursors)))
                           :scrollIntoView true}))))

(defn- line-starts
  [text]
  (into [0] (keep-indexed (fn [i c] (when (= "\n" c) (inc i)))) text))

(defn- line-at
  [starts offset]
  (dec (count (take-while #(<= % offset) starts))))

(defn- join-onto
  "Joins `line` onto `content` the way VS Code's joinLines does: without its indentation, after one
   space, and not at all when it is blank. Returns the joined content, and where they were joined."
  [[content _] line]
  (let [text (string/triml line)]
    (cond
      (string/blank? text) [content (count content)]
      (= "" content) [text 0]
      (re-find #"\s$" content) (let [content (string/replace content #"\s+$" " ")]
                                 [(str content text) (count content)])
      :else [(str content " " text) (count content)])))

(defn- selection-span
  "The lines that joining lines joins for the selection `[anchor head]`: the lines it covers, or its line
   and the next."
  [starts [anchor head]]
  (let [from (min anchor head)
        to (max anchor head)
        first-line (line-at starts from)
        last-line (line-at starts to)]
    {:selection [anchor head]
     :from from
     :to to
     :first-line first-line
     :last-line (if (= first-line last-line) (inc first-line) last-line)}))

(defn- separate-spans
  [spans]
  (reduce (fn [kept span]
            (if (some-> (peek kept) :last-line (>= (:first-line span)))
              kept
              (conj kept span)))
          []
          (sort-by :first-line spans)))

(defn- span-change
  [lines starts {:keys [first-line last-line]}]
  (let [[joined point] (reduce join-onto
                               [(nth lines first-line) (count (nth lines first-line))]
                               (subvec lines (inc first-line) (inc last-line)))
        from (nth starts first-line)]
    {:from from
     :to (+ (nth starts last-line) (count (nth lines last-line)))
     :insert joined
     :point (+ from point)}))

(defn- joined-selection
  [starts {:keys [from to first-line selection]} {:keys [point]} shift]
  (cond
    (= from to) [(+ point shift) (+ point shift)]
    (= first-line (line-at starts to)) (mapv #(+ % shift) selection)
    :else [(+ from shift) (+ point shift)]))

(defn join-lines
  "The `{:changes :selections}` that VS Code's joinLines makes of the `[anchor head]` `selections` in
   `text`. An empty or one-line selection joins its line with the next, and a longer one joins the lines
   it covers. A selection whose lines another selection joins is dropped. Nil when nothing joins."
  [text selections]
  (let [lines (string/split text #"\n" -1)
        starts (line-starts text)
        spans (->> selections
                   (map #(selection-span starts %))
                   separate-spans
                   (filterv #(< (:last-line %) (count lines))))
        changes (mapv #(span-change lines starts %) spans)
        shifts (reductions + 0 (map (fn [{:keys [from to insert]}] (- (count insert) (- to from))) changes))]
    (when (seq changes)
      {:changes (mapv #(select-keys % [:from :to :insert]) changes)
       :selections (mapv #(joined-selection starts %1 %2 %3) spans changes shifts)})))

(defn- join-lines-command
  [^js target]
  (let [state (.-state target)]
    (when-let [{:keys [changes selections]} (join-lines (.. state -doc toString) (:ranges (selection-data (.-selection state))))]
      (update! target #js {:changes (clj->js changes)
                           :selection (editor-selection {:ranges selections :main 0})
                           :scrollIntoView true
                           :userEvent "input"}))))

(defn- select-highlights
  "Selects every occurrence of the selection, or of the word at the cursor."
  [^js target]
  (let [selection (.. target -state -selection)]
    (when (and (= 1 (.. selection -ranges -length)) (.. selection -main -empty))
      (selectNextOccurrence target))
    (selectSelectionMatches target)))

(def by-name
  "The REPL Input's commands, by the name the extension posts. Each takes the editor's view."
  {"undo" undo
   "redo" redo
   "cursorUndo" cursor-undo
   "addSelectionToNextFindMatch" selectNextOccurrence
   "selectHighlights" select-highlights
   "insertCursorAbove" addCursorAbove
   "insertCursorBelow" addCursorBelow
   "insertCursorAtEndOfEachLineSelected" insert-cursors-at-line-ends
   "commentLine" toggleLineComment
   "moveLinesUp" moveLineUp
   "moveLinesDown" moveLineDown
   "copyLinesUp" copyLineUp
   "copyLinesDown" copyLineDown
   "deleteLines" deleteLine
   "indentLines" indentMore
   "outdentLines" indentLess
   "joinLines" join-lines-command})

(def extensions
  "What the commands need in the editor's state: several cursors, and the cursors that cursor undo goes
   back to."
  #js [(.of (.-allowMultipleSelections EditorState) true)
       cursor-history])
