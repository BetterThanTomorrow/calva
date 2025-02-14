(ns calva.repl.webview.core
  (:require
   [calva.util :as util]
   [clojure.string :as str]))

(defonce repl-output-webview-panel (atom nil))

(defn dispose-repl-output-webview-panel []
  (reset! repl-output-webview-panel nil))

(defn post-message-to-webview [message]
  (let [webview-panel ^js @repl-output-webview-panel]
    (when webview-panel
      (.. webview-panel
          -webview
          (postMessage (clj->js (merge
                                 {:id (str (random-uuid))} ;; Provide an id if one wasn't provided by the caller
                                 message)))))))

(defn get-webview-html
  [js-source css-href csp-source]
  (let [is-debug-env js/process.env.IS_DEBUG]
    (str "
<!DOCTYPE html>
<html lang=\"en\">
  <head>
    <meta charset=\"UTF-8\" />

    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />

    <!-- The connect-src and 'unsafe-eval' are only needed in development mode for the
         shadow-cljs dev workflow to function properly -->
    <meta http-equiv=\"Content-Security-Policy\"
          content=\"default-src 'none';
                    style-src https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css
                              https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css
                              https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/base16/windows-high-contrast.min.css
                              https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/base16/windows-high-contrast-light.min.css
                              " csp-source ";
                    script-src https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js
                               https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/clojure.min.js
                               " (when is-debug-env " 'unsafe-eval' ") csp-source ";
                    " (when is-debug-env "connect-src ws://localhost:9630/api/remote-relay;") "
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
</html>")))

(defn set-webview-html!
  [^js webview-panel]
  (let [extension-uri (.. ^js @util/context -extensionUri)
        js-path (.. ^js @util/vscode -Uri (joinPath extension-uri "repl-output-ui" "js" "main.js"))
        js-source (.. ^js webview-panel -webview (asWebviewUri js-path))
        css-path (.. ^js @util/vscode -Uri (joinPath extension-uri "repl-output-ui" "css" "main.css"))
        css-href (.. ^js webview-panel -webview (asWebviewUri css-path))
        csp-source (.. ^js webview-panel -webview -cspSource)
        webview-html (get-webview-html js-source css-href csp-source)]
    (set! (.. webview-panel -webview -html) webview-html)))

(defn set-code-theme!
  "Takes a vscode.ColorThemeKind and sets the code theme in the webview"
  [color-theme-kind]
  (let [color-theme-kind-enum (.. ^js @util/vscode -ColorThemeKind)
        code-theme (condp = color-theme-kind
                     (.. color-theme-kind-enum -Dark)  "dark"
                     (.. color-theme-kind-enum -Light) "light"
                     (.. color-theme-kind-enum -HighContrast) "high-contrast"
                     (.. color-theme-kind-enum -HighContrastLight) "high-contrast-light"
                     nil)]
    (if code-theme
      (post-message-to-webview {:command-name "set-code-theme"
                                :content code-theme})
      (js/console.error
       "Cannot set code theme in output webview. There is no code theme set for the ColorThemeKind enum value of"
       color-theme-kind))))

;; TODO: Refactor functions like this to take in the required state as parameters?
;; It would make testing easier.
(defn color-theme-change-listener []
  (.. ^js @util/vscode -window
      (onDidChangeActiveColorTheme
       (fn [e]
         (set-code-theme! (.. e -kind))))))

(defn add-subscriptions []
  (let [subscriptions [(color-theme-change-listener)]]
    (run! (fn [subscription]
            (.. ^js @util/context -subscriptions (push subscription)))
          subscriptions)))

(defn create-repl-output-webview-panel []
  (add-subscriptions)
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
    (.. ^js webview-panel (onDidDispose dispose-repl-output-webview-panel))
    (set-webview-html! webview-panel)
    (reset! repl-output-webview-panel webview-panel)))

(defn show-repl-output-webview-panel []
  (let [^js webview-panel (or @repl-output-webview-panel (create-repl-output-webview-panel))
        active-code-theme-kind (.. ^js @util/vscode -window -activeColorTheme -kind)]
    (.. webview-panel (reveal nil true))
    (set-code-theme! active-code-theme-kind)))

;; TODO: Add tests
;; TODO: Refactor this to use a mapping of output category -> command name
(defn ^:export append
  [^js options message]
  (let [output-category (.-outputCategory options)]
    (case output-category
      "otherOut" (post-message-to-webview {:command-name "show-stdout"
                                           :content message})
      "evalOut" (post-message-to-webview {:command-name "show-stdout"
                                          :content message})
      "evalResults" (post-message-to-webview {:command-name "show-result"
                                              :content message})
      ;; TODO: Make this show differently?
      "evalErr" (post-message-to-webview {:command-name "show-stdout"
                                          :content message})
      "otherErr" (post-message-to-webview {:command-name "show-stdout"
                                           :content message})
      "clojure" (post-message-to-webview {:command-name "show-result"
                                          :content message})
      (js/console.error
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
    (post-message-to-webview {:command-name "show-stdout"
                              :content stacktrace-message})))

(defn ^:export clear-webview []
  (post-message-to-webview {:command-name "clear-webview"}))

;; TODO: See if can send repl output to webview when it's hidden and see it once unhidden
;; "You cannot send messages to a hidden webview, even when retainContextWhenHidden is enabled."
;; https://code.visualstudio.com/api/extension-guides/webview#theming-webview-content

(comment
  (def output-category "foo")
  (def message "hello")
  (show-repl-output-webview-panel)

  ;; TODO: Implement this interface for communicating with the webview
  ;; Message
  {;; This message contains a command
   :command {;; Command name
             :name "show-result"
             ;; Command args
             :args {:result "Hello world"}}
   ;; Message id
   :id "1234"}

  (post-message-to-webview {:command-name "show-stdout"
                            :result "send while hidden"})

  (post-message-to-webview {:command "clear-output"})

  @repl-output-webview-panel

  ;; TODO: Don't worry about scrolling yet. We know we can do that. Explore other important unknowns first.

  :rcf)
