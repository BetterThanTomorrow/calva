(ns fiddles.repl-input-semantic-tokens
  "clojure-lsp's semantic tokens for the REPL Input, through a copy like `lsp/repl-input-copy.ts` sends.
   Evaluate in the `:calva-lib` runtime of the Extension Development Host."
  (:require [calva.repl.input.completion :as completion]
            [calva.repl.input.host :as host]
            [calva.state :as state]
            [calva.util :as util]
            [clojure.string :as string]))

(comment
  (do
    (def vsc @util/vscode)
    (def client (.getClientForDocumentUri (state/get-state-value "LSP_CLIENT_PROVIDER")
                                          (.. vsc -workspace -workspaceFolders (at 0) -uri)))
    (def legend (js->clj (.. client -initializeResult -capabilities -semanticTokensProvider -legend)
                         :keywordize-keys true)))

  ;; The URI the REPL Input's copy uses, and one inside a source path of test-data's pirate-lang project.
  ;; Neither exists on disk. clojure-lsp gives keyword tokens only for the second: it drops keyword usages
  ;; of files outside the source paths. Closing a copy inside them re-lints, in the background, the files
  ;; that use the vars it defined, and those that define the vars it used (`notify-references`, logged in
  ;; /tmp/clojure-lsp.out). A copy with the followed file's text re-lints every user of that namespace.
  (do
    (def outside-uri (str (.. client -clientOptions -workspaceFolder -uri) "/.calva/repl-input/repl_input.clj"))
    (def inside-uri "file:///Users/pez/Projects/calva/test-data/projects/pirate-lang/src/pez/repl_input_probe.clj"))

  (defn decode
    "Returns `[line character length type modifiers]` for LSP's relative token ints in `data`."
    [{:keys [tokenTypes tokenModifiers]} data]
    (loop [[delta-line delta-start length type-index modifier-bits & more] data line 0 character 0 tokens []]
      (if (nil? delta-line)
        tokens
        (let [line (+ line delta-line)
              character (if (zero? delta-line) (+ character delta-start) delta-start)]
          (recur more line character
                 (conj tokens [line character length (get tokenTypes type-index)
                               (vec (keep-indexed (fn [i modifier] (when (bit-test modifier-bits i) modifier))
                                                  tokenModifiers))]))))))

  (defn tokens+
    "Opens a copy with `copy-text` at `uri`, asks for the tokens from `start-line` on, closes the copy and
     says it was deleted. Resolves to `{:ms :tokens}` with each token as `[line text type modifiers]`.
     A range request leaves out the `comment` tokens clojure-lsp gives ignored forms; a full request has them.
     Run one at a time: two cycles on the same URI close each other's copy."
    [uri copy-text start-line]
    (let [doc #js {:uri uri}
          t0 (js/performance.now)
          copy-lines (string/split-lines copy-text)]
      (-> (.sendNotification client "textDocument/didOpen"
                             #js {:textDocument #js {:uri uri :languageId "clojure" :version 1 :text copy-text}})
          (.then #(.sendRequest client "textDocument/semanticTokens/range"
                                #js {:textDocument doc
                                     :range #js {:start #js {:line start-line :character 0}
                                                 :end #js {:line (count copy-lines) :character 0}}}))
          (.then (fn [^js result]
                   {:ms (js/Math.round (- (js/performance.now) t0))
                    :tokens (vec (for [[line character length type modifiers] (decode legend (vec (some-> result .-data)))]
                                   [line (subs (nth copy-lines line) character (+ character length)) type modifiers]))}))
          (.finally (fn []
                      (-> (.sendNotification client "textDocument/didClose" #js {:textDocument doc})
                          (.then #(.sendNotification client "workspace/didChangeWatchedFiles"
                                                     #js {:changes #js [#js {:uri uri :type 3}]}))))))))

  ;; The REPL Input's text in a copy after the followed file, as completion builds it
  (do
    (def followed-text (str (.readFileSync (js/require "fs") "/Users/pez/Projects/calva/test-data/projects/pirate-lang/src/pez/pirate_lang.clj" "utf8")))
    (def repl-input-text "(defn shout [s]\n  (let [n (count s)]\n    (string/upper-case s)))\n#_(shout \"ignored\")\n(-> :pirate/arr ::local name (str \"!\"))\n(to-pirate-talk \"hello\" english-o)")
    (def copy (completion/copy (:repl-input.context/line @host/!state) followed-text repl-input-text 0)))

  (-> (tokens+ outside-uri (:text copy) (:text-line copy))
      (.then #(def outside-result %)))
  outside-result

  (-> (tokens+ inside-uri (:text copy) (:text-line copy))
      (.then #(def inside-result %)))
  inside-result

  :rcf)
