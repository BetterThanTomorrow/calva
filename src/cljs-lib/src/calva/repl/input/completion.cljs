(ns calva.repl.input.completion
  "The REPL Inputs' completion: the copy that clojure-lsp completes in, when typing asks for candidates,
   the candidates as CodeMirror shows them, their docs, and the context keys that let `tab` and `enter`
   pick one."
  (:require
   [clojure.string :as string]))

(def active-context "calva:replInputCompletionActive")

(def accepts-enter-context "calva:replInputCompletionAcceptsEnter")

(def settings
  "VS Code's suggest settings that the REPL Inputs follow. They are read for Clojure."
  ["editor.quickSuggestions"
   "editor.quickSuggestionsDelay"
   "editor.acceptSuggestionOnEnter"
   "editor.suggest.showIcons"
   "editor.suggest.showInlineDetails"])

(def ^:private default-quick-suggestions
  {"other" "on" "comments" "off" "strings" "off"})

(defn- quick-suggestions-in?
  "True when `editor.quickSuggestions` shows the list as you type in `place`: `other`, `comments` or `strings`."
  [settings place]
  (let [value (get settings "editor.quickSuggestions" default-quick-suggestions)]
    (contains? #{true "on"} (if (map? value) (get value place) value))))

(defn suggests?
  "True when a request asks for candidates: an `explicit?` one, or one as you type where
   `editor.quickSuggestions` is on, by the `cursor-contexts` at the cursor."
  [settings cursor-contexts explicit?]
  (boolean
   (or explicit?
       (quick-suggestions-in? settings (cond
                                         (get cursor-contexts "calva:cursorInString") "strings"
                                         (get cursor-contexts "calva:cursorInComment") "comments"
                                         :else "other")))))

(defn- accepts-enter?
  [settings]
  (not= "off" (get settings "editor.acceptSuggestionOnEnter")))

(defn contexts
  "Returns the completion context keys while the completion list is `active?`, under the `settings`."
  [active? settings]
  {active-context (boolean active?)
   accepts-enter-context (boolean (and active? (accepts-enter? settings)))})

(defn editor-settings
  "Returns what the REPL Input's CodeMirror completion takes from the `settings`."
  [settings]
  {:activate-on-typing? (boolean (some #(quick-suggestions-in? settings %) (keys default-quick-suggestions)))
   :delay (get settings "editor.quickSuggestionsDelay" 10)
   :accept-on-enter? (accepts-enter? settings)
   :icons? (not (false? (get settings "editor.suggest.showIcons")))})

(defn copy
  "Returns the copy that clojure-lsp completes in, with the cursor at `offset` in `text` as its `:line` and
   `:character` there, and the line where `text` starts as `:text-line`. The copy is the followed file's
   `editor-text`, or the `ns` form of a locked `context` or of a context without a file, and then `text`."
  [{:repl-input.context/keys [ns-form locked?]} editor-text text offset]
  (let [prefix (if (and editor-text (not locked?)) editor-text ns-form)
        before (subs text 0 offset)
        text-line (inc (count (re-seq #"\n" prefix)))]
    {:text (str prefix "\n" text)
     :text-line text-line
     :line (+ text-line (count (re-seq #"\n" before)))
     :character (- offset (inc (.lastIndexOf before "\n")))}))

(def ^:private kind-types
  "CodeMirror's completion types, which pick the icon, for the LSP completion item kinds."
  {1 "text" 2 "method" 3 "function" 4 "constructor" 5 "field" 6 "variable" 7 "class" 8 "interface"
   9 "namespace" 10 "property" 11 "unit" 12 "value" 13 "enum" 14 "keyword" 15 "snippet" 16 "color"
   17 "file" 18 "reference" 19 "folder" 20 "enum-member" 21 "constant" 22 "struct" 23 "event"
   24 "operator" 25 "type-parameter"})

(def ^:private snippet-kind 15)

(def ^:private snippet-format 2)

(defn- option
  [show-details? index {:keys [label kind detail insertText insertTextFormat textEdit]}]
  (when-not (or (= snippet-kind kind) (= snippet-format insertTextFormat))
    (let [inserted (or (:newText textEdit) insertText label)]
      (cond-> {:label label :type (get kind-types kind "text") :index index}
        (and show-details? (seq detail)) (assoc :detail detail)
        (not= inserted label) (assoc :apply inserted)))))

(defn options
  "Returns the LSP completion `items` as CodeMirror options, each with the `:index` of its item, and its
   detail when `editor.suggest.showInlineDetails` is on. Snippets are left out."
  [items settings]
  (into [] (keep-indexed (partial option (not (false? (get settings "editor.suggest.showInlineDetails"))))) items))

(def ^:private after-docstring
  "Where clojure-lsp's docs go on after the docstring: clojuredocs' examples, links and notes, or where the
   var is defined."
  #"\n+(?:__Examples:__|__See also:__|__Notes:__|----)\n")

(defn arglists-and-docstring
  "Returns the markdown `docs` of a candidate up to the end of its docstring."
  [docs]
  (some-> docs (string/split after-docstring 2) first string/trimr))
