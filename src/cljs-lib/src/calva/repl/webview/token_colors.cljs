(ns calva.repl.webview.token-colors
  (:require
   ["fs" :as fs]
   ["jsonc-parser" :as jsonc]
   ["path" :as path]
   [calva.util :as util]
   [clojure.string :as string]))

(def hljs-scope->textmate-scope
  "The TextMate scope from Calva's Clojure grammar that colors what highlight.js gives each scope."
  {"keyword" "storage.control.clojure"
   "title" "entity.global.clojure"
   "name" "entity.name.function.clojure"
   "built_in" "entity.name.function.clojure"
   "symbol" "constant.keyword.clojure"
   "string" "string.quoted.double.clojure"
   "number" "constant.numeric.long.clojure"
   "comment" "comment.line.semicolon.clojure"
   "literal" "constant.language.boolean.clojure"
   "regex" "string.regexp.clojure"})

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
        :when foreground
        selector (rule-scopes scope)]
    [selector foreground]))

(defn resolve-foreground
  "Returns the foreground of the rule whose scope selector is the longest prefix of `textmate-scope`.
   Of equally long selectors, the last rule wins."
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

(defn hljs-colors
  "Returns highlight.js scope → foreground for the TextMate `token-colors`."
  [token-colors]
  (let [rules (token-rules token-colors)]
    (into {} (for [[hljs-scope textmate-scope] hljs-scope->textmate-scope
                   :let [foreground (resolve-foreground rules textmate-scope)]
                   :when foreground]
               [hljs-scope foreground]))))

(defn active-theme
  "Returns the theme in `themes` that the workbench settings make active for `color-theme-kind`."
  [themes
   {:workbench/keys [color-theme preferred-color-theme]
    :window/keys [auto-detect-color-scheme?]}
   color-theme-kind]
  (let [ui-theme (color-theme-kind->ui-theme color-theme-kind)
        theme-names (if auto-detect-color-scheme?
                      [preferred-color-theme color-theme]
                      [color-theme preferred-color-theme])]
    (first (for [theme-name theme-names
                 {:theme/keys [id label] :as theme} themes
                 :when (and (= ui-theme (:theme/ui-theme theme))
                            (some #{theme-name} [id label]))]
             theme))))

(defn customization-rules
  "Returns the TextMate rules in `editor.tokenColorCustomizations` that apply to `theme`, the theme's own last."
  [customizations {:theme/keys [id label]}]
  (concat (get customizations "textMateRules")
          (mapcat #(get-in customizations [(str "[" % "]") "textMateRules"])
                  (distinct (remove nil? [id label])))))

(defn- read-token-colors
  "Returns the `tokenColors` of the theme file at `theme-file`, after those of the files it includes."
  [theme-file]
  (let [{:strs [include tokenColors]} (js->clj (jsonc/parse (str (fs/readFileSync theme-file "utf8"))))]
    (concat (when include
              (read-token-colors (path/join (path/dirname theme-file) include)))
            (when (sequential? tokenColors)
              tokenColors))))

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
  (let [workbench (.. vscode -workspace (getConfiguration "workbench"))]
    {:workbench/color-theme (.get workbench "colorTheme")
     :workbench/preferred-color-theme (.get workbench (color-theme-kind->preferred-setting color-theme-kind))
     :window/auto-detect-color-scheme? (.. vscode -workspace (getConfiguration "window") (get "autoDetectColorScheme"))}))

(defn- user-customizations
  [^js vscode]
  (js->clj (.. vscode -workspace (getConfiguration "editor") (get "tokenColorCustomizations"))))

(defn active-theme-hljs-colors
  "Returns highlight.js scope → foreground for the active color theme of `color-theme-kind`, with the user's
   `editor.tokenColorCustomizations`, or nil when the theme can't be found or read."
  [color-theme-kind]
  (when-let [^js vscode @util/vscode]
    (try
      (when-let [{:theme/keys [file] :as theme} (active-theme (contributed-themes vscode)
                                                              (theme-settings vscode color-theme-kind)
                                                              color-theme-kind)]
        (hljs-colors (concat (read-token-colors file)
                             (customization-rules (user-customizations vscode) theme))))
      (catch :default e
        (util/log-to-console :error "Cannot read the color theme's token colors:" e)
        nil))))
