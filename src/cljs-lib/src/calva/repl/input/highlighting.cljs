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

(def ^:private font-styles [:bold :italic :underline :strikethrough])

(defn- font-style-parts
  "Returns which of bold, italic, underline and strikethrough the TextMate `font-style`, like `italic bold`,
   sets, the ones it doesn't name as false."
  [font-style]
  (into {} (map (fn [k] [k (string/includes? font-style (name k))])) font-styles))

(defn scope-color
  "Returns the foreground of the innermost of `scopes` that one of `token-rules` matches."
  [token-rules scopes]
  (some #(token-colors/resolve-setting token-rules %) (reverse scopes)))

(defn scope-styles
  "Returns the font styles, like `#{:italic}`, of the innermost of `scopes` that one of `font-style-rules` matches,
   or nil when none matches or it sets none."
  [font-style-rules scopes]
  (some->> (some #(token-colors/resolve-setting font-style-rules %) (reverse scopes))
           font-style-parts
           (keep (fn [[style set?]] (when set? style)))
           not-empty
           set))

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

(defn- best-style
  "Returns the style the `rules`, `[selector value]` in order, give a token of `token-type` with `modifiers`:
   each property from the best scoring rule that sets it, the later of equally scoring ones. `style-of` gives
   the style a rule's value sets."
  [rules style-of token-type modifiers]
  (first (reduce (fn [best [selector value]]
                   (if-let [score (selector-score selector token-type modifiers)]
                     (reduce-kv (fn [[style scores :as best] property setting]
                                  (if (>= score (get scores property -1))
                                    [(assoc style property setting) (assoc scores property score)]
                                    best))
                                best
                                (style-of value))
                     best))
                 [{} {}]
                 rules)))

(defn- rule-font-styles
  "Returns the font styles a semantic token rule's `settings` set: all four from a `fontStyle`, else those of
   `bold`, `italic`, `underline` and `strikethrough` it has."
  [{font-style "fontStyle" :as settings}]
  (if (string? font-style)
    (font-style-parts font-style)
    (into {} (filter (comp boolean? val)) (zipmap font-styles (map #(get settings (name %)) font-styles)))))

(defn- rule-style
  "Returns the style the value of a semantic token rule sets: a color, or a map with a `foreground`, and a
   `fontStyle` or some of `bold`, `italic`, `underline` and `strikethrough`."
  [value]
  (if (string? value)
    {:foreground value}
    (cond-> (rule-font-styles value)
      (get value "foreground") (assoc :foreground (get value "foreground")))))

(defn- probed-style
  "Returns the style of the first of `scopes` that a TextMate rule of `palette` sets a foreground or a font
   style for, as VS Code probes the scopes of a default rule."
  [{:palette/keys [token-rules font-style-rules]} scopes]
  (some (fn [scope]
          (let [foreground (token-colors/resolve-setting token-rules scope)
                font-style (token-colors/resolve-setting font-style-rules scope)]
            (when (or foreground font-style)
              (merge (when foreground {:foreground foreground})
                     (some-> font-style font-style-parts)))))
        scopes))

(defn semantic-style
  "Returns the style files get for a semantic token of `token-type` with `modifiers`, as VS Code picks it: each
   of `:foreground`, `:bold`, `:italic`, `:underline` and `:strikethrough` from the semantic token rules, the
   user's after the theme's, else from the default rules. A property that no rule sets is left out."
  [{:palette/keys [semantic-rules] :as palette} token-type modifiers]
  (merge (best-style default-rules #(probed-style palette %) token-type modifiers)
         (best-style semantic-rules rule-style token-type modifiers)))

(defn- paint
  [looks from to look]
  (reduce #(assoc! %1 %2 look) looks (range from to)))

(defn- runs
  "Returns `[from to color styles]` for each run of one color and font styles in `looks`, a `[color styles]`
   per character, without the runs that have neither."
  [looks]
  (->> (map-indexed vector looks)
       (partition-by second)
       (keep (fn [run]
               (let [[from [color styles]] (first run)]
                 (when (or color styles)
                   [from (inc (first (last run))) color styles]))))
       vec))

(defn highlighting
  "Returns `[from to color styles]` for `text`, from its grammar `tokens` in the colors and font styles of
   `palette`, with `styles` like `#{:italic}`, or nil."
  [{:palette/keys [token-rules font-style-rules]} text tokens]
  (let [look-of (memoize (fn [scopes]
                           [(scope-color token-rules scopes) (scope-styles font-style-rules scopes)]))]
    (runs (persistent! (reduce (fn [looks [from to scopes]]
                                 (let [[color styles :as look] (look-of scopes)]
                                   (if (or color styles)
                                     (paint looks from to look)
                                     looks)))
                               (transient (vec (repeat (count text) nil)))
                               tokens)))))

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

(defn- token-look
  "Returns `[color font-styles]` for a semantic token of `token-type` with `modifiers`, the font styles it sets
   or unsets, like `{:italic true}`, or nil when it has neither, or is a comment."
  [palette token-type modifiers]
  (when (not= "comment" token-type)
    (let [{:keys [foreground] :as style} (semantic-style palette token-type modifiers)
          font-styles (not-empty (dissoc style :foreground))]
      (when (or foreground font-styles)
        [foreground font-styles]))))

(defn semantic-ranges
  "Returns `[from to color font-styles]` in `text` for the decoded semantic `tokens` of a copy where `text`
   starts on line `text-line`. Leaves out comment tokens."
  [palette tokens text-line text]
  (let [starts (line-starts text)]
    (vec (for [[line character length token-type modifiers] tokens
               :let [start (get starts (- line text-line))
                     [color font-styles :as look] (when start (token-look palette token-type modifiers))]
               :when look]
           [(+ start character) (+ start character length) color font-styles]))))

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
  "Returns `[from to color styles]` for `text` as files get it from Calva's grammar in the active color theme,
   or nil before the grammar is loaded."
  [text]
  (when-let [grammar @!grammar]
    (when-let [current (palette)]
      (highlighting current text (grammar-tokens grammar text)))))

(def ^:private max-printed-length
  "The longest printed code that is highlighted. The grammar takes the extension host about 2.7 ms per 1,000
   characters."
  50000)

(defn printed-highlighting
  "Returns `[from to color styles]` for printed `text`, as `text-highlighting` does, or nil for text longer
   than `max-printed-length`."
  [text]
  (when (<= (count text) max-printed-length)
    (text-highlighting text)))

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
