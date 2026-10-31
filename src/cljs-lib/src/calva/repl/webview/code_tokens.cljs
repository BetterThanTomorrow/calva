(ns calva.repl.webview.code-tokens
  "clojure-lsp's semantic tokens for the printed code in the Output views. The code of one namespace goes in
   one copy, below the text of the namespace's file when it is open, else below an `ns` form, so one
   clojure-lsp cycle covers it all."
  (:require
   [calva.repl.input.highlighting :as highlighting]
   [calva.util :as util]))

(defn- ns-document
  "Returns an open Clojure document whose namespace `adapter` finds to be `ns`, or nil."
  [^js adapter ns]
  (some (fn [^js document]
          (when (and (= "clojure" (.-languageId document))
                     (= "file" (.. document -uri -scheme))
                     (= ns (first (.editorNamespace adapter document js/undefined))))
            document))
        (some-> ^js @util/vscode .-workspace .-textDocuments array-seq)))

(defn copy
  "Returns the copy with each of `codes`, `[id text]`, on lines of its own below `prefix`, as `{:text :lines}`,
   with `:lines` the line each code's id starts on."
  [prefix codes]
  (reduce (fn [{:keys [text] :as copied} [id code]]
            (-> copied
                (assoc-in [:lines id] (inc (count (re-seq #"\n" text))))
                (assoc :text (str text "\n" code))))
          {:text prefix :lines {}}
          codes))

(defn- extension
  "Returns the extension of the copy for `document`, or for `session-key` when there is no document."
  [^js document session-key]
  (or (some->> document .-fileName (re-find #"\.(clj|cljs|cljc)$") second)
      (if (some-> session-key (.startsWith "cljs")) "cljs" "clj")))

(defn code-ranges
  "Returns `[id ranges]` for each of `codes`, `[id text]`, from the decoded semantic `tokens` of a copy where
   the codes start on the `lines` of their ids."
  [palette tokens lines codes]
  (mapv (fn [[id code]]
          [id (highlighting/semantic-ranges palette tokens (get lines id) code)])
        codes))

(defn tokens+
  "Returns a promise of `[id ranges]` for the printed `codes`, `[id text]` each, of the namespace `ns` in the
   session `session-key`, from clojure-lsp's semantic tokens through `adapter`. A promise of nil when files
   get no semantic highlighting, before the grammar is loaded, or without clojure-lsp."
  [^js adapter ns session-key codes]
  (let [palette (highlighting/palette)]
    (if (and @highlighting/!grammar (:palette/semantic? palette) (seq codes))
      (let [^js document (ns-document adapter ns)
            {:keys [text lines]} (copy (if document (.getText document) (str "(ns " ns ")")) codes)
            ^js answer (.lspSemanticTokens adapter
                                           (some-> document .-uri)
                                           #js {:text text :extension (extension document session-key)}
                                           (apply min (vals lines)))]
        (.then (.-tokens answer)
               (fn [^js result]
                 (when result
                   (code-ranges palette
                                (highlighting/decode (js->clj (.-legend result) :keywordize-keys true)
                                                     (vec (.-data result)))
                                lines
                                codes)))))
      (js/Promise.resolve nil))))
