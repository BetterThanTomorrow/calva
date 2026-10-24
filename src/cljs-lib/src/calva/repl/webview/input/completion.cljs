(ns calva.repl.webview.input.completion
  "The REPL Input's completion list and docs panel, in the suggest widget's colors, with the candidates and
   the docs the extension answers with."
  (:require
   [clojure.string :as string]
   ["@codemirror/autocomplete" :refer [acceptCompletion autocompletion completionStatus moveCompletionSelection
                                       startCompletion]]
   ["@codemirror/state" :refer [Prec]]
   ["@codemirror/view" :refer [EditorView keymap]]
   ["highlight.js/lib/core" :as hljs]))

(def ^:private word-character
  "The characters of a word, as Calva finds words in Clojure files."
  #"[^\s,#()\[\]{}꞉;\"\\@]")

(defn word-start
  "Returns where the word that ends at `offset` in `text` starts, after a leading syntax quote."
  [text offset]
  (let [start (loop [i offset]
                (if (and (pos? i) (re-matches word-character (nth text (dec i))))
                  (recur (dec i))
                  i))]
    (if (and (< start offset) (= "`" (nth text start)))
      (inc start)
      start)))

(defn valid-for?
  "True while the `typed` word still narrows the candidates for `prefix`: it starts with `prefix` and adds
   no `/` or `.`, after which other candidates complete."
  [prefix typed]
  (and (string/starts-with? typed prefix)
       (not (re-find #"[/.]" (subs typed (count prefix))))))

(defn restart?
  "True when the `restart`, the final answer to a request that was first answered with only the REPL's
   candidates, still fits the word that starts at `from` in `text` before `offset`."
  [restart text from offset]
  (boolean (and restart
                (= from (:from restart))
                (valid-for? (:prefix restart) (subs text from offset)))))

(defn doc-blocks
  "Splits the markdown `docs` into `[:code text]` for its fenced code blocks and `[:text text]` for the rest."
  [docs]
  (->> (string/split docs #"```")
       (map-indexed (fn [i part]
                      (if (odd? i)
                        [:code (string/trimr (string/replace-first part #"^[^\n]*\n" ""))]
                        [:text (string/trim part)])))
       (remove (comp string/blank? second))))

(defn open?
  "True while the completion list shows in `state`."
  [^js state]
  (= "active" (completionStatus state)))

(defonce ^{:private true
           :doc "The request waiting for the extension's answer, the request whose list shows only the REPL's
                 candidates so far, the final answer that restarts it, and the docs being resolved."}
  !requests (atom {:last 0 :pending {} :shown nil :restart nil :docs {}}))

(defn- docs-element
  [detail documentation]
  (let [blocks (cond-> []
                 (seq detail) (conj [:code detail])
                 (seq documentation) (into (doc-blocks documentation)))]
    (when (seq blocks)
      (let [element (js/document.createElement "div")]
        (doseq [[kind text] blocks]
          (let [child (js/document.createElement (if (= :code kind) "pre" "p"))]
            (if (= :code kind)
              (set! (.-innerHTML child) (.-value (.highlight hljs text #js {:language "clojure" :ignoreIllegals true})))
              (set! (.-textContent child) text))
            (.appendChild element child)))
        element))))

(defn- docs+
  "Asks the extension for the docs of the candidate at `index` in the answer to `request`, and returns a
   promise of the element that shows them, or of nil."
  [dispatch! request index]
  (js/Promise.
   (fn [resolve _]
     (swap! !requests assoc-in [:docs [request index]] resolve)
     (dispatch! [:repl-input/ax.resolve-completion {:request request :index index}]))))

(defn deliver-docs!
  "Shows the docs the extension resolved for a candidate, unless the list moved on."
  [{:repl-input.completion/keys [request index detail documentation]}]
  (when-let [resolve (get-in @!requests [:docs [request index]])]
    (swap! !requests update :docs dissoc [request index])
    (resolve (docs-element detail documentation))))

(defn- result
  [dispatch! request {:keys [from prefix]} options]
  #js {:from from
       :options (into-array (for [{:keys [index] :as option} options]
                              (doto (clj->js (dissoc option :index))
                                (aset "info" (fn [_] (docs+ dispatch! request index))))))
       :validFor (fn [typed] (valid-for? prefix typed))})

(defn- request+
  "Asks the extension for the candidates at `offset` in `text`, and returns a promise of CodeMirror's
   result. The request before it gets no result, and the docs it asked for none."
  [dispatch! {:keys [text offset explicit?] :as request}]
  (js/Promise.
   (fn [resolve _]
     (let [[before after] (swap-vals! !requests (fn [{:keys [last] :as requests}]
                                                  (assoc requests
                                                         :last (inc last)
                                                         :pending {(inc last) (assoc request :resolve resolve)}
                                                         :shown nil
                                                         :restart nil
                                                         :docs {})))]
       (doseq [waiting (concat (map :resolve (vals (:pending before))) (vals (:docs before)))]
         (waiting nil))
       (dispatch! [:repl-input/ax.complete {:request (:last after)
                                            :text text
                                            :offset offset
                                            :explicit? (boolean explicit?)}])))))

(defn- source
  "CodeMirror's completion source: the final answer that restarts the list, or a request to the extension
   when a word ends at the cursor or the list was asked for."
  [dispatch!]
  (fn [^js context]
    (let [text (.. context -state -doc toString)
          offset (.-pos context)
          from (word-start text offset)
          {:keys [restart]} @!requests]
      (cond
        (restart? restart text from offset)
        (do (swap! !requests assoc :restart nil)
            (result dispatch! (:request restart) restart (:options restart)))

        (or (.-explicit context) (< from offset))
        (request+ dispatch! {:from from :prefix (subs text from offset) :text text :offset offset
                             :explicit? (.-explicit context)})))))

(defn deliver!
  "Gives CodeMirror the extension's answer to `request`. A final answer to a request whose list shows only
   the REPL's candidates restarts the list with it."
  [^js view dispatch! {:repl-input.completion/keys [request options final?]}]
  (let [{:keys [pending shown]} @!requests]
    (if-let [{:keys [resolve] :as waiting} (get pending request)]
      (do (swap! !requests assoc
                 :pending {}
                 :shown (when-not final? (assoc (select-keys waiting [:from :prefix]) :request request)))
          (resolve (result dispatch! request waiting options)))
      (when (and final? view (= request (:request shown)) (open? (.-state view)))
        (swap! !requests assoc :shown nil :restart (assoc shown :options options))
        (startCompletion view)))))

(defn- completion-keymap
  "The keys of the completion list. `enter` picks a candidate unless `editor.acceptSuggestionOnEnter` is off."
  [accept-on-enter?]
  (.highest Prec
            (.of keymap
                 (into-array (cond-> [#js {:key "Ctrl-Space" :run startCompletion}
                                      #js {:key "ArrowDown" :run (moveCompletionSelection true)}
                                      #js {:key "ArrowUp" :run (moveCompletionSelection false)}
                                      #js {:key "PageDown" :run (moveCompletionSelection true "page")}
                                      #js {:key "PageUp" :run (moveCompletionSelection false "page")}
                                      #js {:key "Tab" :run acceptCompletion}]
                               accept-on-enter? (conj #js {:key "Enter" :run acceptCompletion}))))))

(def ^:private theme
  (.theme EditorView
          #js {".cm-tooltip.cm-tooltip-autocomplete"
               #js {:backgroundColor "var(--vscode-editorSuggestWidget-background)"
                    :color "var(--vscode-editorSuggestWidget-foreground)"
                    :border "1px solid var(--vscode-editorSuggestWidget-border)"
                    :fontFamily "var(--vscode-editor-font-family, monospace)"}
               ".cm-tooltip-autocomplete > ul > li[aria-selected]"
               #js {:backgroundColor "var(--vscode-editorSuggestWidget-selectedBackground)"
                    :color "var(--vscode-editorSuggestWidget-selectedForeground)"}
               ".cm-completionMatchedText"
               #js {:textDecoration "none"
                    :fontWeight "bold"
                    :color "var(--vscode-editorSuggestWidget-highlightForeground)"}
               ".cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionMatchedText"
               #js {:color "var(--vscode-editorSuggestWidget-focusHighlightForeground)"}
               ".cm-completionDetail"
               #js {:fontStyle "normal"
                    :opacity "0.7"}
               ".cm-tooltip.cm-completionInfo"
               #js {:backgroundColor "var(--vscode-editorHoverWidget-background)"
                    :color "var(--vscode-editorHoverWidget-foreground)"
                    :border "1px solid var(--vscode-editorHoverWidget-border)"
                    :padding "4px 8px"
                    :maxWidth "min(500px, 90vw)"}
               ".cm-completionInfo pre"
               #js {:margin "0 0 4px 0"
                    :whiteSpace "pre-wrap"
                    :fontFamily "var(--vscode-editor-font-family, monospace)"}
               ".cm-completionInfo p"
               #js {:margin "0 0 4px 0"
                    :whiteSpace "pre-wrap"}}))

(defn extension
  "CodeMirror's completion for the REPL Input, following the `settings`, or none while it isn't `enabled?`."
  [dispatch! {:keys [enabled? activate-on-typing? delay accept-on-enter? icons?]}]
  (if enabled?
    #js [theme
         (completion-keymap accept-on-enter?)
         (autocompletion #js {:override #js [(source dispatch!)]
                              :defaultKeymap false
                              :activateOnTyping activate-on-typing?
                              :activateOnTypingDelay delay
                              :icons icons?})]
    #js []))
