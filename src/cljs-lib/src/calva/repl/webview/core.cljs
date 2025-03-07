(ns calva.repl.webview.core
  (:require
   [calva.util :as util]
   [clojure.string :as str]))

(defonce repl-output-webview-panel (atom nil))

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

;; The connect-src and unsafe-eval are only needed in development mode for the shadow-cljs
;; dev workflow to function properly
(defn get-webview-html
  [{:env/keys [is-debug]} {:keys [js-source css-href csp-source]}]
  (str "
<!DOCTYPE html>
<html lang=\"en\">
  <head>
    <meta charset=\"UTF-8\" />

    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />

    <meta http-equiv=\"Content-Security-Policy\"
          content=\"default-src 'none';
                    style-src https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css
                              https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css
                              https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/base16/windows-high-contrast.min.css
                              https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/base16/windows-high-contrast-light.min.css
                              " csp-source ";
                    script-src https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js
                               https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/clojure.min.js
                               " (when is-debug " 'unsafe-eval' ") csp-source ";
                    " (when is-debug "connect-src ws://localhost:9630/api/remote-relay;") "
                    base-uri 'none';
                    form-action 'none';\">

    <title>REPL Output</title>

    <link rel=\"stylesheet\" href=\"" css-href "\" />

    <!-- Should these stylesheets and scripts be saved and referenced locally so that if users are offline the webview still functions as expected? -->
    <link
      rel=\"stylesheet\"
      href=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css\"
      data-code-theme=\"dark\"
      disabled
    />
    <link
      rel=\"stylesheet\"
      href=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css\"
      data-code-theme=\"light\"
      disabled
    />
    <link
      rel=\"stylesheet\"
      href=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/base16/windows-high-contrast.min.css\"
      data-code-theme=\"high-contrast\"
      disabled
    />
    <link
      rel=\"stylesheet\"
      href=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/base16/windows-high-contrast-light.min.css\"
      data-code-theme=\"high-contrast-light\"
      disabled
    />

    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js\"></script>
    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/clojure.min.js\"></script>

  </head>
  <body>
    <div id=\"output\"></div>

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
   {:keys [^js webview-panel]}]
  (let [js-source (get-js-source context {:webview-panel webview-panel})
        css-path (get-css-path context)
        css-href (.. ^js webview-panel -webview (asWebviewUri css-path))
        csp-source (.. ^js webview-panel -webview -cspSource)
        webview-html (get-webview-html context {:js-source js-source :css-href css-href :csp-source csp-source})]
    (set! (.. webview-panel -webview -html) webview-html)))

(defn set-code-theme!
  "Takes a context, a webview panel and a vscode.ColorThemeKind enum value and sets the code theme in the webview based
   on the given color theme kind."
  [{:keys [vscode/vscode]} {:keys [color-theme-kind webview-panel]}]
  (let [color-theme-kind-enum (.. ^js vscode -ColorThemeKind)
        code-theme (condp = color-theme-kind
                     (.. color-theme-kind-enum -Dark)  "dark"
                     (.. color-theme-kind-enum -Light) "light"
                     (.. color-theme-kind-enum -HighContrast) "high-contrast"
                     (.. color-theme-kind-enum -HighContrastLight) "high-contrast-light"
                     nil)]
    (if code-theme
      (post-message-to-webview webview-panel {:command/name "set-code-theme"
                                              :content code-theme})
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
         (set-code-theme! context {:color-theme-kind (.. e -kind)
                                   :webview-panel webview-panel})))))

(defn add-subscriptions []
  (let [context {:vscode/vscode @util/vscode}
        subscriptions [(create-color-theme-change-listener context {:webview-panel @repl-output-webview-panel})]]
    (run! (fn [subscription]
            (.. ^js @util/vscode-context -subscriptions (push subscription)))
          subscriptions)))

(defn create-repl-output-webview-panel
  [context]
  (let [webview-panel (.. ^js @util/vscode -window
                          (createWebviewPanel
                           "calva:repl-output"
                           "REPL Output"
                           #js {:preserveFocus true
                                :viewColumn (.. ^js @util/vscode -ViewColumn -Beside)}
                           #js {:enableScripts true
                                ;; If performance or memory consumption becomes a problem, we can use the setState
                                ;; and getState to manually retain the context of the webview when it's hidden.
                                ;; See https://code.visualstudio.com/api/extension-guides/webview#persistence
                                :retainContextWhenHidden true
                                :enableFindWidget true}))]
    (.. ^js webview-panel (onDidDispose (fn [] (dispose-repl-output-webview-panel repl-output-webview-panel))))
    (set-webview-html! context {:webview-panel webview-panel})
    (reset! repl-output-webview-panel webview-panel)
    (add-subscriptions)
    webview-panel))

;; TODO: Write spec/schema for context
(defn ^:export show-repl-output-webview-panel []
  (let [context {:env/is-debug (if (= js/process.env.IS_DEBUG "true") true false)
                 :vscode/vscode @util/vscode
                 :vscode/context @util/vscode-context}
        ^js webview-panel (or @repl-output-webview-panel (create-repl-output-webview-panel context))
        active-code-theme-kind (.. ^js @util/vscode -window -activeColorTheme -kind)]
    (.. webview-panel (reveal nil true))
    (set-code-theme! context {:color-theme-kind active-code-theme-kind
                              :webview-panel webview-panel})))

;; TODO: Add tests
;; TODO: Refactor this to use a mapping of output category -> command name
(defn ^:export append
  [^js options message]
  (let [output-category (.-outputCategory options)]
    (case output-category
      "otherOut" (post-message-to-webview @repl-output-webview-panel {:command/name "show-stdout"
                                                                      :content message})
      "evalOut" (post-message-to-webview @repl-output-webview-panel {:command/name "show-stdout"
                                                                     :content message})
      "evalResults" (post-message-to-webview @repl-output-webview-panel {:command/name "show-result"
                                                                         :content message})
      ;; TODO: Make this show differently?
      "evalErr" (post-message-to-webview @repl-output-webview-panel {:command/name "show-stdout"
                                                                     :content message})
      "otherErr" (post-message-to-webview @repl-output-webview-panel {:command/name "show-stdout"
                                                                      :content message})
      "clojure" (post-message-to-webview @repl-output-webview-panel {:command/name "show-result"
                                                                     :content message})
      (util/log-to-console
       :error
       (str "Cannot append content to output webview. No outputCategory matches \"" output-category "\"")))))

(def stacktrace-classes-to-ignore
  #{"clojure.lang.RestFn"
    "clojure.lang.AFn"})

(defn stacktrace-entry->string
  [{:keys [var name file line]}]
  (let [name (or var name)]
    (str name " (" file ":" line ")")))

(defn ^:export append-stacktrace
  [^js stacktrace]
  (let [stacktrace (js->clj stacktrace :keywordize-keys true)
        stacktrace-message (->> stacktrace
                                (filter (fn [{:keys [flags class]}]
                                          (and (not (some #{"dup"} flags))
                                               (not (contains? stacktrace-classes-to-ignore class)))))
                                (map stacktrace-entry->string)
                                (str/join "\n"))]
    (post-message-to-webview @repl-output-webview-panel {:command/name "show-stdout"
                                                         :content stacktrace-message})))

(defn ^:export clear-webview []
  (post-message-to-webview @repl-output-webview-panel {:command/name "clear-webview"}))

;; TODO: See if can send repl output to webview when it's hidden and see it once unhidden
;; "You cannot send messages to a hidden webview, even when retainContextWhenHidden is enabled."
;; https://code.visualstudio.com/api/extension-guides/webview#theming-webview-content
