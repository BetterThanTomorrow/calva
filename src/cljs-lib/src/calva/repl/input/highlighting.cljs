(ns calva.repl.input.highlighting
  "The REPL Input's highlighting as files get it: Calva's grammar, with clojure-lsp's semantic tokens over it,
   in the colors of the active color theme."
  (:require
   ["fs" :as fs]
   ["path" :as path]
   ["vscode-oniguruma" :as onig]
   ["vscode-textmate" :as tm]
   [calva.repl.webview.token-colors :as token-colors]
   [calva.util :as util]
   [clojure.string :as string]))

(def default-rules
  "VS Code's default semantic token rules for the types and modifiers clojure-lsp uses, as `[selector scopes]`
   in the order VS Code registers them, with Calva's `semanticTokenScopes` last. A rule colors with the first
   of its TextMate scopes that a theme rule matches."
  [["comment" ["comment"]]
   ["keyword" ["keyword.control"]]
   ["namespace" ["entity.name.namespace"]]
   ["type" ["entity.name.type" "support.type"]]
   ["class" ["entity.name.type.class" "support.class"]]
   ["interface" ["entity.name.type.interface"]]
   ["function" ["entity.name.function" "support.function"]]
   ["method" ["entity.name.function.member" "support.function"]]
   ["macro" ["entity.name.function.preprocessor"]]
   ["variable" ["variable.other.readwrite" "entity.name.variable"]]
   ["event" ["variable.other.event"]]
   ["type.defaultLibrary" ["support.type"]]
   ["class.defaultLibrary" ["support.class"]]
   ["interface.defaultLibrary" ["support.class"]]
   ["variable.defaultLibrary" ["support.variable" "support.other.variable"]]
   ["function.defaultLibrary" ["support.function"]]
   ["macro:clojure" ["storage.control.clojure" "keyword.control.clojure"]]])

(defn scope-color
  "Returns the foreground of the innermost of `scopes` that one of `token-rules` matches."
  [token-rules scopes]
  (some #(token-colors/resolve-foreground token-rules %) (reverse scopes)))

(defn- selector-score
  "Returns VS Code's score for the semantic token `selector`, like `function.defaultLibrary:clojure`, on a
   token of `token-type` with `modifiers`, or nil when it doesn't match the token."
  [selector token-type modifiers]
  (let [[type-and-modifiers language] (string/split selector #":")
        [selector-type & selector-modifiers] (string/split type-and-modifiers #"\.")
        matches [(contains? #{"*" token-type} selector-type)
                 (every? (set modifiers) selector-modifiers)
                 (contains? #{nil "clojure"} language)]]
    (when (every? true? matches)
      (+ (if (= "*" selector-type) 0 100)
         (* 100 (count selector-modifiers))
         (if language 10 0)))))

(defn- best-color
  "Returns the color of the best scoring of `rules`, `[selector value]` in order, the later of equally scoring
   ones, among those `color-of` gives a color for their value. Nil when none matches."
  [rules color-of token-type modifiers]
  (->> rules
       (keep (fn [[selector value]]
               (when-let [score (selector-score selector token-type modifiers)]
                 (when-let [color (color-of value)]
                   [score color]))))
       (reduce (fn [best candidate]
                 (if (>= (first candidate) (first best)) candidate best))
               [-1 nil])
       second))

(defn semantic-color
  "Returns the foreground files get for a semantic token of `token-type` with `modifiers`, as VS Code picks it:
   from the semantic token rules, the user's after the theme's, else from the default rules."
  [{:palette/keys [token-rules semantic-rules]} token-type modifiers]
  (or (best-color semantic-rules
                  #(if (string? %) % (get % "foreground"))
                  token-type
                  modifiers)
      (best-color default-rules
                  (fn [scopes] (some #(token-colors/resolve-foreground token-rules %) scopes))
                  token-type
                  modifiers)))

(defn- keyword-parts
  "Returns `[from to token-type]` for the parts of the keyword from `from` to `to` in `text`, as clojure-lsp
   gives them to files: the namespace as type, the slash as event, and the name as keyword."
  [text from to]
  (let [[_ colons ns-part name-part] (re-matches #"(::?)(?:([^/]+)/)?(.+)" (subs text from to))]
    (cond
      (nil? name-part) []
      ns-part (let [ns-from (+ from (count colons))
                    slash (+ ns-from (count ns-part))]
                [[ns-from slash "type"] [slash (inc slash) "event"] [(inc slash) to "keyword"]])
      :else [[(+ from (count colons)) to "keyword"]])))

(defn- innermost?
  [scope-prefix [_ _ scopes]]
  (string/starts-with? (str (peek scopes)) scope-prefix))

(defn keyword-tokens
  "Returns `[from to token-type]` for the keywords in the grammar `tokens` of `text`, as clojure-lsp gives
   them to files, the name after the colon of simple metadata included."
  [text tokens]
  (vec (mapcat (fn [[previous [from to :as token]]]
                 (cond
                   (innermost? "constant.keyword.clojure" token)
                   (keyword-parts text from to)

                   (and previous
                        (innermost? "meta.metadata.simple.clojure" previous)
                        (= ":" (subs text (first previous) (second previous)))
                        (= (second previous) from)
                        (innermost? "entity.name.variable.clojure" token))
                   [[from to "keyword"]]

                   :else []))
               (map vector (cons nil tokens) tokens))))

(defn- paint
  [colors from to color]
  (reduce #(assoc! %1 %2 color) colors (range from to)))

(defn- colored-runs
  "Returns `[from to color]` for each run of one color in `colors`, one color per character, without the runs
   that have none."
  [colors]
  (->> (map-indexed vector colors)
       (partition-by second)
       (keep (fn [run]
               (let [[from color] (first run)]
                 (when color
                   [from (inc (first (last run))) color]))))
       vec))

(defn highlighting
  "Returns `[from to color]` for `text`, from its grammar `tokens` in the colors of `palette`, with the
   keywords colored as semantic tokens when files get semantic highlighting."
  [{:palette/keys [token-rules semantic?] :as palette} text tokens]
  (let [color-of (memoize #(scope-color token-rules %))
        grammar-colors (reduce (fn [colors [from to scopes]]
                                 (if-let [color (color-of scopes)]
                                   (paint colors from to color)
                                   colors))
                               (transient (vec (repeat (count text) nil)))
                               tokens)
        colors (if semantic?
                 (reduce (fn [colors [from to token-type]]
                           (if-let [color (semantic-color palette token-type [])]
                             (paint colors from to color)
                             colors))
                         grammar-colors
                         (keyword-tokens text tokens))
                 grammar-colors)]
    (colored-runs (persistent! colors))))

(defn- line-starts
  [text]
  (vec (reductions + 0 (map (comp inc count) (string/split text #"\n" -1)))))

(defn decode
  "Returns `[line character length token-type modifiers]` for each semantic token in `data`, LSP's relative
   encoding with `legend`."
  [{:keys [tokenTypes tokenModifiers]} data]
  (->> (partition 5 data)
       (reductions (fn [[line character] [delta-line delta-start length type-index modifier-bits]]
                     [(+ line delta-line)
                      (if (zero? delta-line) (+ character delta-start) delta-start)
                      length
                      (get tokenTypes type-index)
                      (vec (keep-indexed (fn [i modifier] (when (bit-test modifier-bits i) modifier))
                                         tokenModifiers))])
                   [0 0])
       rest
       vec))

(defn semantic-ranges
  "Returns `[from to color]` in `text` for the decoded semantic `tokens` of a copy where `text` starts on
   line `text-line`. Leaves out comment tokens."
  [palette tokens text-line text]
  (let [starts (line-starts text)]
    (vec (for [[line character length token-type modifiers] tokens
               :let [start (get starts (- line text-line))
                     color (when (not= "comment" token-type)
                             (semantic-color palette token-type modifiers))]
               :when (and start color)]
           [(+ start character) (+ start character length) color]))))

(defn grammar-tokens
  "Returns `[from to scopes]` for each token `grammar` finds in `text`."
  [^js grammar text]
  (loop [[line & more] (string/split text #"\n" -1)
         offset 0
         stack (.-INITIAL tm)
         tokens (transient [])]
    (if (nil? line)
      (persistent! tokens)
      (let [^js result (.tokenizeLine grammar line stack)
            ^js line-tokens (.-tokens result)
            n (.-length line-tokens)
            tokens (reduce (fn [tokens i]
                             (let [^js token (aget line-tokens i)
                                   start (.-startIndex token)
                                   ^js next-token (when (< (inc i) n) (aget line-tokens (inc i)))
                                   end (if next-token (.-startIndex next-token) (count line))]
                               (cond-> tokens
                                 (< start end) (conj! [(+ offset start) (+ offset end) (vec (.-scopes token))]))))
                           tokens
                           (range n))]
        (recur more (+ offset (count line) 1) (.-ruleStack result) tokens)))))

(defonce !grammar (atom nil))

(defn- onig-wasm-file
  "Returns the path of the Oniguruma wasm the grammar needs, in `out/` where a packaged extension has it, or
   in `node_modules`, or nil when the extension at `extension-path` has neither."
  [extension-path]
  (some #(when (fs/existsSync %) %)
        [(path/join extension-path "out/onig.wasm")
         (path/join extension-path "node_modules/vscode-oniguruma/release/onig.wasm")]))

(defn- clojure-grammar+
  "Returns a promise of Calva's grammar from the extension at `extension-path`, once Oniguruma is loaded."
  [extension-path]
  (let [grammar-file (path/join extension-path "clojure.tmLanguage.json")
        onig-lib #js {:createOnigScanner (fn [patterns] (new onig/OnigScanner patterns))
                      :createOnigString (fn [s] (new onig/OnigString s))}]
    (.loadGrammar (new tm/Registry #js {:onigLib (js/Promise.resolve onig-lib)
                                        :loadGrammar (fn [scope-name]
                                                       (when (= "source.clojure" scope-name)
                                                         (tm/parseRawGrammar (str (fs/readFileSync grammar-file "utf8"))
                                                                             grammar-file)))})
                  "source.clojure")))

(defn load-grammar!
  "Loads Calva's grammar from the extension at `extension-path`. Returns a promise of the grammar, or of nil
   when it can't be loaded or the extension has no Oniguruma wasm."
  [extension-path]
  (if-let [wasm-file (onig-wasm-file extension-path)]
    (-> (js/Promise.resolve)
        (.then #(onig/loadWASM (fs/readFileSync wasm-file)))
        (.then #(clojure-grammar+ extension-path))
        (.then #(reset! !grammar %))
        (.catch (fn [e]
                  (util/log-to-console :error "Cannot load the grammar for the REPL Input:" e)
                  nil)))
    (js/Promise.resolve nil)))

(defonce !palette (atom nil))

(defn palette
  "Returns the active color theme's palette, reading the theme only after `clear-palette!`."
  []
  (or @!palette
      (when-let [^js vscode @util/vscode]
        (reset! !palette (token-colors/active-theme-palette (.. vscode -window -activeColorTheme -kind))))))

(defn clear-palette!
  []
  (reset! !palette nil))

(defn text-highlighting
  "Returns `[from to color]` for `text` as files get it from Calva's grammar in the active color theme, or nil
   before the grammar is loaded."
  [text]
  (when-let [grammar @!grammar]
    (when-let [current (palette)]
      (highlighting current text (grammar-tokens grammar text)))))

(defn with-text-highlighting
  "Returns the REPL Input `record` with the highlighting of its text, computed anew only when the text, the
   palette or the grammar changed."
  [{:repl-input/keys [text highlighting-of] :as record}]
  (let [current [text (palette) @!grammar]]
    (cond-> record
      (not= current highlighting-of) (assoc :repl-input/highlighting-of current
                                            :repl-input/highlighting (text-highlighting text)))))

(defn highlighting-message
  "Returns the message that posts the highlighting of the REPL Input `record` at its version, with whether files
   get semantic highlighting, or nil when it has none. The webview moves its own along with the edits, so it
   gets it at every version."
  [{:repl-input/keys [version highlighting]}]
  (when highlighting
    {:command/name "repl-input-highlighting"
     :repl-input/version version
     :repl-input/highlighting highlighting
     :repl-input/semantic? (boolean (:palette/semantic? (palette)))}))
