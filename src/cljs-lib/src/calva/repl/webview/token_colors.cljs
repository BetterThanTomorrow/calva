(ns calva.repl.webview.token-colors
  (:require
   ["fs" :as fs]
   ["jsonc-parser" :as jsonc]
   ["path" :as path]
   [calva.util :as util]
   [clojure.string :as string]))

(def color-theme-kind->ui-theme
  "The `uiTheme` a contributed theme declares, for each `vscode.ColorThemeKind` value."
  {1 "vs"
   2 "vs-dark"
   3 "hc-black"
   4 "hc-light"})

(def color-theme-kind->preferred-setting
  "The `workbench` setting with the preferred theme, for each `vscode.ColorThemeKind` value."
  {1 "preferredLightColorTheme"
   2 "preferredDarkColorTheme"
   3 "preferredHighContrastColorTheme"
   4 "preferredHighContrastLightColorTheme"})

(defn- rule-scopes
  [scope]
  (cond
    (string? scope) (map string/trim (string/split scope #","))
    (sequential? scope) scope
    :else []))

(defn token-rules
  "Returns `[scope-selector foreground]` for each scope selector in TextMate `token-colors` that sets a foreground."
  [token-colors]
  (for [{:strs [scope settings]} token-colors
        :let [foreground (get settings "foreground")]
        :when (and (string? foreground) (seq foreground))
        selector (rule-scopes scope)]
    [selector foreground]))

(defn font-style-rules
  "Returns `[scope-selector font-style]` for each scope selector in TextMate `token-colors` that sets a font
   style. An empty font style is kept, since it clears the styles of shorter selectors."
  [token-colors]
  (for [{:strs [scope settings]} token-colors
        :let [font-style (get settings "fontStyle")]
        :when (string? font-style)
        selector (rule-scopes scope)]
    [selector font-style]))

(defn resolve-setting
  "Returns the setting of the rule, `[scope-selector setting]`, whose scope selector is the longest prefix of
   `textmate-scope`. Of equally long selectors, the last rule wins."
  [rules textmate-scope]
  (->> rules
       (filter (fn [[selector _]]
                 (or (= selector textmate-scope)
                     (string/starts-with? textmate-scope (str selector ".")))))
       (reduce (fn [best rule]
                 (if (or (nil? best)
                         (>= (count (first rule)) (count (first best))))
                   rule
                   best))
               nil)
       second))

(defn active-theme
  "Returns the theme in `themes` that the workbench settings make active for `color-theme-kind`, or, when they
   name no theme there is, the settings' default theme, as VS Code falls back to."
  [themes
   {:workbench/keys [color-theme preferred-color-theme default-themes]
    :window/keys [auto-detect-color-scheme?]}
   color-theme-kind]
  (let [ui-theme (color-theme-kind->ui-theme color-theme-kind)
        theme-names (concat (if auto-detect-color-scheme?
                              [preferred-color-theme color-theme]
                              [color-theme preferred-color-theme])
                            default-themes)]
    (first (for [theme-name theme-names
                 {:theme/keys [id label] :as theme} themes
                 :when (and (= ui-theme (:theme/ui-theme theme))
                            (some #{theme-name} [id label]))]
             theme))))

(def ^:private token-group-scopes
  "The scopes VS Code gives each group in `editor.tokenColorCustomizations`, like `comments`. VS Code's
   `keyword - keyword.operator` is `keyword` here, since Calva's grammar has no `keyword.operator`."
  [["comments" ["comment" "punctuation.definition.comment"]]
   ["strings" ["string" "meta.embedded.assembly"]]
   ["keywords" ["keyword" "keyword.control" "storage" "storage.type"]]
   ["numbers" ["constant.numeric"]]
   ["types" ["entity.name.type" "entity.name.class" "support.type" "support.class"]]
   ["functions" ["entity.name.function" "support.function"]]
   ["variables" ["variable" "entity.name.variable"]]])

(defn- customization-object-rules
  "Returns the TextMate rules of one `editor.tokenColorCustomizations` object: its groups, a color or settings
   each, and then its `textMateRules`."
  [customization]
  (concat (for [[group scopes] token-group-scopes
                :let [value (get customization group)]
                :when value
                scope scopes]
            {"scope" scope "settings" (if (string? value) {"foreground" value} value)})
          (get customization "textMateRules")))

(defn customization-rules
  "Returns the TextMate rules in `editor.tokenColorCustomizations` that apply to `theme`, the theme's own last."
  [customizations {:theme/keys [id label]}]
  (mapcat customization-object-rules
          (cons customizations
                (map #(get customizations (str "[" % "]"))
                     (distinct (remove nil? [id label]))))))

(defn- read-token-colors
  "Returns the `tokenColors` of the theme file at `theme-file`, after those of the files it includes."
  [theme-file]
  (let [{:strs [include tokenColors]} (js->clj (jsonc/parse (str (fs/readFileSync theme-file "utf8"))))]
    (concat (when include
              (read-token-colors (path/join (path/dirname theme-file) include)))
            (when (sequential? tokenColors)
              tokenColors))))

(defonce !theme-token-colors (atom nil))

(defn theme-token-colors
  "Returns the `tokenColors` of the theme file at `theme-file`, reading the file only when it isn't the file
   read last, or after `clear-theme-token-colors!`."
  [theme-file]
  (let [{:theme/keys [file token-colors]} @!theme-token-colors]
    (if (= theme-file file)
      token-colors
      (let [token-colors (vec (read-token-colors theme-file))]
        (reset! !theme-token-colors {:theme/file theme-file
                                     :theme/token-colors token-colors})
        token-colors))))

(defn ordered-rules
  "Returns the semantic token rules of the JS object `rules` as `[selector style]`, in their order."
  [rules]
  (if (object? rules)
    (js->clj (js/Object.entries rules))
    []))

(defn- read-theme-semantics
  "Returns the `semanticHighlighting` and the `semanticTokenColors` of the theme file at `theme-file`, the rules
   after those of the files it includes."
  [theme-file]
  (let [^js theme (jsonc/parse (str (fs/readFileSync theme-file "utf8")))
        semantic? (.-semanticHighlighting theme)]
    (cond-> (if-let [include (.-include theme)]
              (read-theme-semantics (path/join (path/dirname theme-file) include))
              {:theme/semantic-highlighting? false
               :theme/semantic-token-colors []})
      (boolean? semantic?) (assoc :theme/semantic-highlighting? semantic?)
      :always (update :theme/semantic-token-colors into (ordered-rules (.-semanticTokenColors theme))))))

(defonce !theme-semantics (atom nil))

(defn- theme-semantics
  "Returns the semantic highlighting of the theme file at `theme-file`, reading the file only when it isn't the
   file read last, or after `clear-theme-token-colors!`."
  [theme-file]
  (let [{:theme/keys [file semantics]} @!theme-semantics]
    (if (= theme-file file)
      semantics
      (let [semantics (read-theme-semantics theme-file)]
        (reset! !theme-semantics {:theme/file theme-file
                                  :theme/semantics semantics})
        semantics))))

(defn clear-theme-token-colors!
  []
  (reset! !theme-token-colors nil)
  (reset! !theme-semantics nil))

(defn- contributed-themes
  [^js vscode]
  (for [^js extension (.. vscode -extensions -all)
        ^js theme (when-let [^js contributes (.. extension -packageJSON -contributes)]
                    (.-themes contributes))]
    {:theme/id (.-id theme)
     :theme/label (.-label theme)
     :theme/ui-theme (.-uiTheme theme)
     :theme/file (path/join (.-extensionPath extension) (.-path theme))}))

(defn- theme-settings
  [^js vscode color-theme-kind]
  (let [^js workbench (.. vscode -workspace (getConfiguration "workbench"))
        preferred-setting (color-theme-kind->preferred-setting color-theme-kind)]
    {:workbench/color-theme (.get workbench "colorTheme")
     :workbench/preferred-color-theme (.get workbench preferred-setting)
     :workbench/default-themes [(some-> (.inspect workbench "colorTheme") .-defaultValue)
                                (some-> (.inspect workbench preferred-setting) .-defaultValue)]
     :window/auto-detect-color-scheme? (.. vscode -workspace (getConfiguration "window") (get "autoDetectColorScheme"))}))

(defn- user-customizations
  [^js vscode]
  (js->clj (.. vscode -workspace (getConfiguration "editor") (get "tokenColorCustomizations"))))

(defn semantic-customization
  "Returns the `enabled` and the `rules`, in their order, of `customizations`, the JS object of
   `editor.semanticTokenColorCustomizations`, that apply to `theme`: the general ones, then the theme's own."
  [^js customizations {:theme/keys [id label]}]
  (reduce (fn [result ^js scoped]
            (cond-> (update result :semantic/rules into (ordered-rules (.-rules scoped)))
              (boolean? (.-enabled scoped)) (assoc :semantic/enabled? (.-enabled scoped))))
          {:semantic/rules []}
          (when (object? customizations)
            (cons customizations
                  (keep #(unchecked-get customizations (str "[" % "]")) (distinct (remove nil? [id label])))))))

(defn semantic-highlighting?
  "True when VS Code colors files with semantic tokens, by `editor.semanticHighlighting.enabled`, and when
   that is `configuredByTheme`, by the user's customization or else the theme."
  [enabled-setting customization-enabled? theme-enabled?]
  (case enabled-setting
    true true
    false false
    (if (some? customization-enabled?) customization-enabled? theme-enabled?)))

(defn active-theme-palette
  "Returns what the REPL Input's highlighting needs of the active color theme of `color-theme-kind`: the
   TextMate foreground and font style rules with the user's, whether Clojure files get semantic highlighting,
   and the semantic token rules in order, the user's after the theme's. Nil when the theme can't be found or
   read."
  [color-theme-kind]
  (when-let [^js vscode @util/vscode]
    (try
      (when-let [{:theme/keys [file] :as theme} (active-theme (contributed-themes vscode)
                                                              (theme-settings vscode color-theme-kind)
                                                              color-theme-kind)]
        (let [^js editor (.. vscode -workspace (getConfiguration "editor" #js {:languageId "clojure"}))
              all-token-colors (concat (theme-token-colors file)
                                       (customization-rules (user-customizations vscode) theme))
              {theme-semantic? :theme/semantic-highlighting?
               :theme/keys [semantic-token-colors]} (theme-semantics file)
              {:semantic/keys [enabled? rules]} (semantic-customization (.get editor "semanticTokenColorCustomizations")
                                                                        theme)]
          {:palette/token-rules (vec (token-rules all-token-colors))
           :palette/font-style-rules (vec (font-style-rules all-token-colors))
           :palette/semantic? (semantic-highlighting? (.get editor "semanticHighlighting.enabled")
                                                      enabled?
                                                      theme-semantic?)
           :palette/semantic-rules (into semantic-token-colors rules)}))
      (catch :default e
        (util/log-to-console :error "Cannot read the color theme's semantic token colors:" e)
        nil))))
