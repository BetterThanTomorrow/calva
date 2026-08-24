(ns calva.repl.webview.core
  (:require
   [calva.repl.webview.greeting :as greeting]
   [calva.util :as util]
   [clojure.string :as str]))

(defonce output-view-webview-panel (atom nil))
(defonce registered-webviews (atom #{}))
(defonce word-wrap-override (atom nil))

(defn register-webview!
  [^js webview]
  (swap! registered-webviews conj webview))

(defn unregister-webview!
  [^js webview]
  (swap! registered-webviews disj webview))

(defn get-editor-word-wrap-setting
  []
  (if-let [vscode @util/vscode]
    (let [setting (.. ^js vscode -workspace (getConfiguration "editor") (get "wordWrap"))]
      (not= "off" setting))
    false))

(defn word-wrap?
  []
  (if (some? @word-wrap-override)
    @word-wrap-override
    (get-editor-word-wrap-setting)))

(defn set-word-wrap-context!
  [wrap?]
  (when-let [vscode @util/vscode]
    (.. ^js vscode -commands (executeCommand "setContext" "calva:outputWordWrap" (boolean wrap?)))))

(defn dispose-repl-output-webview-panel
  [webview-panel-atom]
  (reset! webview-panel-atom nil))

(defn post-message-to-webview [^js webview-panel message]
  (when webview-panel
    (.. webview-panel
        -webview
        (postMessage (pr-str (merge
                              {:id (str (random-uuid))} ;; Provide an id if one wasn't provided by the caller
                              message))))))

(defn post-word-wrap!
  [^js webview-panel wrap?]
  (when webview-panel
    (post-message-to-webview webview-panel {:command/name "set-word-wrap"
                                            :word-wrap (boolean wrap?)})))

(defn post-word-wrap-to-all-views!
  [wrap?]
  (run! #(post-word-wrap! % wrap?) @registered-webviews))

(defn ^:export toggle-word-wrap
  []
  (let [new-wrap? (not (word-wrap?))]
    (reset! word-wrap-override new-wrap?)
    (set-word-wrap-context! new-wrap?)
    (post-word-wrap-to-all-views! new-wrap?)))

(defn create-word-wrap-change-listener
  []
  (when-let [vscode @util/vscode]
    (.. ^js vscode -workspace
        (onDidChangeConfiguration
         (fn [^js event]
           (when (.affectsConfiguration event "editor.wordWrap")
             (reset! word-wrap-override nil)
             (let [wrap? (word-wrap?)]
               (set-word-wrap-context! wrap?)
               (post-word-wrap-to-all-views! wrap?))))))))

(defn ^:export init-word-wrap!
  []
  (set-word-wrap-context! (word-wrap?))
  (when-let [vscode-context @util/vscode-context]
    (when-let [listener (create-word-wrap-change-listener)]
      (.. ^js vscode-context -subscriptions (push listener)))))

(def highlight-js-code-theme-stylesheet-data
  [["dark" "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css"]
   ["light" "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css"]
   ["high-contrast" "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/base16/windows-high-contrast.min.css"]
   ["high-contrast-light" "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/base16/windows-high-contrast-light.min.css"]])

(defn highlight-js-code-theme-stylesheet-link
  [code-theme [theme href]]
  (str "    <link
      rel=\"stylesheet\"
      href=\"" href "\"
      data-code-theme=\"" theme "\""
       (when (not= code-theme theme)
         "
      disabled")
       "
    />"))

(defn highlight-js-code-theme-stylesheet-links
  [code-theme]
  (str/join "\n" (map #(highlight-js-code-theme-stylesheet-link code-theme %)
                       highlight-js-code-theme-stylesheet-data)))

(defn code-theme-for-kind
  [^js color-theme-kind-enum color-theme-kind]
  (condp = color-theme-kind
    (.. color-theme-kind-enum -Dark) "dark"
    (.. color-theme-kind-enum -Light) "light"
    (.. color-theme-kind-enum -HighContrast) "high-contrast"
    (.. color-theme-kind-enum -HighContrastLight) "high-contrast-light"
    nil))

(defn code-theme-from-context
  [{:keys [^js vscode/vscode]}]
  (when vscode
    (code-theme-for-kind (.-ColorThemeKind vscode)
                         (.. vscode -window -activeColorTheme -kind))))

;; The connect-src and unsafe-eval are only needed in development mode for the shadow-cljs
;; dev workflow to function properly

(defn get-webview-html
  [{:env/keys [is-debug]} {:keys [js-source css-href csp-source code-theme greeting-html word-wrap?]}]
  (str "
<!DOCTYPE html>
<html lang=\"en\">
  <head>
    <meta charset=\"UTF-8\" />

    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />

    <meta http-equiv=\"Content-Security-Policy\"
          content=\"default-src 'none';
                    img-src data: " csp-source ";
                    style-src https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css
                              https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css
                              https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/base16/windows-high-contrast.min.css
                              https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/base16/windows-high-contrast-light.min.css
                              https://unpkg.com/highlightjs-copy/dist/highlightjs-copy.min.css
                              " csp-source ";
                    script-src " (when is-debug " 'unsafe-eval' ") csp-source ";
                    " (when is-debug "connect-src ws://localhost:*;") "
                    base-uri 'none';
                    form-action 'none';\">

    <title>REPL Output</title>

    <link rel=\"stylesheet\" href=\"" css-href "\" />

    <!-- Should these stylesheets and scripts be saved and referenced locally so that if users are offline the webview still functions as expected? -->
" (highlight-js-code-theme-stylesheet-links code-theme) "

    <link
      rel=\"stylesheet\"
      href=\"https://unpkg.com/highlightjs-copy/dist/highlightjs-copy.min.css\"
    />

  </head>
  <body" (when word-wrap? " class=\"word-wrap\"") ">
    <div id=\"output\" class=\"output-element-container\">" greeting-html "</div>

    <script src=\"" js-source "\"></script>
  </body>
</html>"))

(defn get-js-source
  [{:keys [vscode/vscode]
    vscode-context :vscode/context}
   {:keys [^js webview-panel]}]
  (let [extension-uri (.. ^js vscode-context -extensionUri)
        js-path (.. ^js vscode -Uri (joinPath extension-uri "repl-output-ui" "js" "main.js"))]
    (.. ^js webview-panel -webview (asWebviewUri js-path))))

(defn get-css-path
  [{:keys [vscode/vscode]
    vscode-context :vscode/context}]
  (let [extension-uri (.. ^js vscode-context -extensionUri)]
    (.. ^js vscode -Uri (joinPath extension-uri "repl-output-ui" "css" "main.css"))))

(defn set-webview-html!
  [context
   {:keys [^js webview-panel view-kind]
    :or {view-kind :output-view}}]
  (let [js-source (get-js-source context {:webview-panel webview-panel})
        css-path (get-css-path context)
        css-href (.. ^js webview-panel -webview (asWebviewUri css-path))
        csp-source (.. ^js webview-panel -webview -cspSource)
        logo-href (greeting/logo-webview-uri context (.-webview webview-panel))
        greeting-html (greeting/html-for-view view-kind logo-href)
        webview-html (get-webview-html context {:js-source js-source
                                                :css-href css-href
                                                :csp-source csp-source
                                                :code-theme (code-theme-from-context context)
                                                :greeting-html greeting-html
                                                :word-wrap? (word-wrap?)})]
    (set! (.. webview-panel -webview -html) webview-html)))

(defn set-code-theme!
  "Takes a context, a webview panel and a vscode.ColorThemeKind enum value and sets the code theme in the webview based
   on the given color theme kind."
  [{:keys [vscode/vscode]} {:keys [color-theme-kind webview-panel]}]
  (let [color-theme-kind-enum (.. ^js vscode -ColorThemeKind)
        code-theme (code-theme-for-kind color-theme-kind-enum color-theme-kind)]
    (if code-theme
      (post-message-to-webview webview-panel {:command/name "set-code-theme"
                                              :code-theme code-theme})
      (util/log-to-console
       :error
       "Cannot set code theme in output webview. There is no code theme set for the ColorThemeKind enum value of"
       color-theme-kind))))

(defn create-color-theme-change-listener
  [{:keys [^js vscode/vscode] :as context}
   {:keys [webview-panel]}]
  (.. vscode -window
      (onDidChangeActiveColorTheme
       (fn [e]
         ;; Ensure syntax highlighting is not broken after the output view is moved into or out of the main
         ;; VS Code window. See https://github.com/BetterThanTomorrow/calva/issues/2895.
         ;; This is probably called more frequently than it needs to be, but if that's problematic we can try to
         ;; figure out how to identify when this event means the output view moved into or out of the main window.
         ;; This event fires for more cases than just that, such as when it's focused or unfocused.
         (set-code-theme! context {:color-theme-kind (.. e -kind)
                                   :webview-panel webview-panel})))))

(defn create-view-state-change-listener
  [{:keys [^js vscode/vscode] :as context}
   {:keys [^js webview-panel]}]
  (.. webview-panel
      (onDidChangeViewState
       (fn [^js _event]
         (set-code-theme! context
                          {:color-theme-kind (.. ^js vscode -window -activeColorTheme -kind)
                           :webview-panel webview-panel})))))

(defn add-subscriptions!
  [{vscode-context :vscode/context
    :as context}
   {:keys [webview-panel]}]
  (let [subscriptions [(create-color-theme-change-listener context {:webview-panel webview-panel})
                       (create-view-state-change-listener context {:webview-panel webview-panel})]]
    (run! (fn [subscription]
            (.. ^js vscode-context -subscriptions (push subscription)))
          subscriptions)))

(defn add-listeners!
  [^js webview-panel]
  (.. webview-panel
      (onDidDispose
       (fn []
         (dispose-repl-output-webview-panel output-view-webview-panel)
         (unregister-webview! webview-panel)))))

(defn initialize-webview-panel
  [context ^js webview-panel]
  (register-webview! webview-panel)
  (add-listeners! webview-panel)
  (add-subscriptions! context {:webview-panel webview-panel})
  (set-webview-html! context {:webview-panel webview-panel})
  webview-panel)

(defn create-repl-output-webview-panel
  [{:keys [vscode/vscode] :as context}]
  (let [webview-panel (.. ^js vscode -window
                          (createWebviewPanel
                           "calva.output-view"
                           "REPL Output"
                           #js {:preserveFocus true
                                :viewColumn (.. ^js vscode -ViewColumn -Beside)}
                           #js {:enableScripts true
                                :enableCommandUris #js ["calva.showReplOutputView"]
                                ;; If performance or memory consumption becomes a problem, we can use the setState
                                ;; and getState to manually retain the context of the webview when it's hidden.
                                ;; See https://code.visualstudio.com/api/extension-guides/webview#persistence
                                ;; See also: https://code.visualstudio.com/api/references/vscode-api#WebviewPanelOptions
                                ;; "retainContextWhenHidden has a high memory overhead and should only be used if your
                                ;; panel's context cannot be quickly saved and restored."
                                ;; Content reloading using setState and getState and message passing between the webview
                                ;; and the extension was attempted, but it proved to be troublesome, so it was removed.
                                ;; If someone wants to attempt to add it again, here's the PR for the removal:
                                ;; https://github.com/BetterThanTomorrow/calva/pull/2896
                                :retainContextWhenHidden true
                                :enableFindWidget true}))]
    (initialize-webview-panel context webview-panel)
    (reset! output-view-webview-panel webview-panel)))

(defn ensure-output-view-panel
  []
  (if-let [webview-panel @output-view-webview-panel]
    webview-panel
    (let [context {:env/is-debug (:is-debug util/env)
                   :vscode/vscode @util/vscode
                   :vscode/context @util/vscode-context}
          webview-panel (create-repl-output-webview-panel context)
          active-color-theme-kind (.. ^js @util/vscode -window -activeColorTheme -kind)]
      (reset! output-view-webview-panel webview-panel)
      (set-code-theme! context {:color-theme-kind active-color-theme-kind
                                :webview-panel webview-panel})
      webview-panel)))

(defn ^:export show-repl-output-webview-panel
  [preserve-focus?]
  (let [context {:env/is-debug (:is-debug util/env)
                 :vscode/vscode @util/vscode
                 :vscode/context @util/vscode-context}
        webview-panel (ensure-output-view-panel)
        active-color-theme-kind (.. ^js @util/vscode -window -activeColorTheme -kind)]
    (.. ^js webview-panel (reveal nil preserve-focus?))
    (set-code-theme! context {:color-theme-kind active-color-theme-kind
                              :webview-panel webview-panel})))

(def output-category->command-name
  {"otherOut" "show-stdout"
   "evalOut" "show-stdout"
   "evalResults" "show-result"
   "evaluatedCode" "show-evaluated-code"
   "evalErr" "show-stdout"
   "otherErr" "show-stdout"
   "clojure" "show-result"})

(defn options->meta
  [^js options]
  (when options
    (let [who (or (and (map? options) (:who options))
                  (and (some? options) (.-who options)))
          ns (or (and (map? options) (:ns options))
                 (and (some? options) (.-ns options)))
          repl-session-key (or (and (map? options) (or (:replSessionKey options) (:replSessionType options) (:repl-session-key options) (:repl-session-type options)))
                               (and (some? options) (or (.-replSessionKey options) (.-replSessionType options))))
          shadow-build (or (and (map? options) (or (:shadowBuild options) (:shadow-build options)))
                           (and (some? options) (.-shadowBuild options)))
          shadow-runtime-id (or (and (map? options) (or (:shadowRuntimeId options) (:shadow-runtime-id options)))
                                (and (some? options) (.-shadowRuntimeId options)))]
      (cond-> {}
        who (assoc :who who)
        ns (assoc :ns ns)
        repl-session-key (assoc :repl-session-key repl-session-key)
        shadow-build (assoc :shadow-build shadow-build)
        (some? shadow-runtime-id) (assoc :shadow-runtime-id shadow-runtime-id)))))

(defn ^:export append
  [^js options message]
  (let [output-category (if (map? options) (:outputCategory options) (.-outputCategory options))
        command-name (get output-category->command-name output-category)
        meta-data (options->meta options)]
    (if command-name
      (post-message-to-webview (ensure-output-view-panel) (cond-> {:command/name command-name
                                                                   :output message}
                                                            (seq meta-data) (assoc :meta meta-data)))
      (util/log-to-console
       :error
       (str "Cannot append output to output webview. No outputCategory matches \"" output-category "\"")))))

(def stacktrace-classes-to-ignore
  #{"clojure.lang.RestFn"
    "clojure.lang.AFn"})

(defn stacktrace-entry->string
  [{:keys [var name file line]}]
  (let [name (or var name)]
    (str name " (" file ":" line ")")))

(defn stacktrace->message
  "Takes a clojurefied stacktrace and returns a string representation of it for printing."
  [stacktrace]
  (->> stacktrace
       (filter (fn [{:keys [flags class]}]
                 (and (not (some #{"dup"} flags))
                      (not (contains? stacktrace-classes-to-ignore class)))))
       (map stacktrace-entry->string)
       (str/join "\n")))

(defn ^:export append-stacktrace
  [^js stacktrace]
  (let [stacktrace (js->clj stacktrace :keywordize-keys true)
        stacktrace-message (stacktrace->message stacktrace)]
    (post-message-to-webview (ensure-output-view-panel) {:command/name "show-stdout"
                                                         :output stacktrace-message})))

(defn ^:export clear-output-view
  []
  (when-let [webview-panel @output-view-webview-panel]
    (post-message-to-webview webview-panel {:command/name "clear-output-view"})))
