(ns calva.repl.webview.sidebar
  (:require
   [calva.repl.webview.core :as core]
   [calva.repl.webview.greeting :as greeting]
   [calva.util :as util]))

(defonce output-sidebar-webview-view (atom nil))
(defonce output-sidebar-log (atom []))
(defonce output-sidebar-showing-output-log? (atom false))

(defn current-output-destinations
  []
  (.. ^js @util/vscode -workspace (getConfiguration "calva") (get "outputDestinations")))

(defn output-sidebar-in-setting?
  [destinations]
  (let [destinations (js->clj destinations :keywordize-keys true)]
    (boolean
     (some (fn [destination]
             (if (sequential? destination)
               (some #(= "output-sidebar" %) destination)
               (= "output-sidebar" destination)))
           (vals destinations)))))

(defn get-sidebar-help-html
  [csp-source]
  (let [destinations (current-output-destinations)]
    (str "<!DOCTYPE html>"
         "<html lang=\"en\"><head>"
         "<meta charset=\"UTF-8\">"
         "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
         "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src " csp-source "\">"
         "<style>"
         "body { color: var(--vscode-foreground); background: var(--vscode-editor-background); "
         "font-family: var(--vscode-font-family); padding: 16px; }"
         "h1 { font-size: 1.2em; } pre { white-space: pre-wrap; }"
         "a { color: var(--vscode-textLink-foreground); }"
         "</style></head><body>"
         "<h1>REPL Output</h1>"
         "<p>REPL results, evaluated code, and other output can be sent to this view with the "
         "<code>output-sidebar</code> <strong>Output destination</strong>.</p>"
         (greeting/destinations-config-html destinations)
         "</body></html>")))

(defn set-sidebar-help!
  [^js webview-view]
  (reset! output-sidebar-showing-output-log? false)
  (set! (.. webview-view -webview -html)
        (get-sidebar-help-html (.. webview-view -webview -cspSource))))

(defn sidebar-context
  []
  {:env/is-debug (:is-debug util/env)
   :vscode/vscode @util/vscode
   :vscode/context @util/vscode-context})

(defn show-sidebar-output-log!
  [^js webview-view]
  (reset! output-sidebar-showing-output-log? true)
  (core/set-webview-html! (sidebar-context) {:webview-panel webview-view
                                             :view-kind :output-sidebar})
  (core/set-code-theme! (sidebar-context)
                        {:color-theme-kind (.. ^js @util/vscode -window -activeColorTheme -kind)
                         :webview-panel webview-view}))

(defn post-output-sidebar-log!
  []
  (run! #(core/post-message-to-webview @output-sidebar-webview-view %)
        @output-sidebar-log))

(defn apply-sidebar-help-or-output-log!
  [^js webview-view]
  (if (output-sidebar-in-setting? (current-output-destinations))
    (do
      (show-sidebar-output-log! webview-view)
      (post-output-sidebar-log!))
    (do
      (set-sidebar-help! webview-view)
      (reset! output-sidebar-log []))))

(defn add-output-sidebar-message!
  [message]
  (when (output-sidebar-in-setting? (current-output-destinations))
    (swap! output-sidebar-log conj message)
    (when @output-sidebar-webview-view
      (core/post-message-to-webview @output-sidebar-webview-view message))))

(defn add-context-subscription!
  [subscription]
  (.. ^js @util/vscode-context -subscriptions (push subscription)))

(defn create-output-destinations-change-listener
  []
  (.. ^js @util/vscode -workspace
      (onDidChangeConfiguration
       (fn [^js event]
         (when (and (.affectsConfiguration event "calva.outputDestinations")
                    @output-sidebar-webview-view)
           (apply-sidebar-help-or-output-log! @output-sidebar-webview-view))))))

(defn ^:export create-repl-output-sidebar-provider
  []
  (let [provider
        #js {:resolveWebviewView
             (fn [^js webview-view _context _token]
               (reset! output-sidebar-webview-view webview-view)
               (set! (.. webview-view -webview -options)
                     #js {:enableScripts true
                          :enableCommandUris #js ["calva.showReplOutputSidebar"]
                          :localResourceRoots #js [(.. ^js @util/vscode-context -extensionUri)]})
               (apply-sidebar-help-or-output-log! webview-view)
               (add-context-subscription!
                (.. webview-view
                    (onDidDispose (fn [] (reset! output-sidebar-webview-view nil)))))
               (add-context-subscription!
                (.. webview-view
                    (onDidChangeVisibility
                     (fn []
                       (when (and (.. webview-view -visible)
                                  (output-sidebar-in-setting? (current-output-destinations)))
                         (core/set-code-theme! (sidebar-context)
                                               {:color-theme-kind (.. ^js @util/vscode -window -activeColorTheme -kind)
                                                :webview-panel webview-view})))))))}]
    (add-context-subscription! (create-output-destinations-change-listener))
    provider))

(defn ^:export show-repl-output-sidebar
  [preserve-focus?]
  (if-let [webview-view @output-sidebar-webview-view]
    (.show webview-view preserve-focus?)
    (.. ^js @util/vscode -commands
        (executeCommand (if preserve-focus?
                          "workbench.view.extension.calva"
                          "calva.output-sidebar.focus")))))

(defn ^:export append
  [^js options message]
  (let [output-category (.-outputCategory options)
        command-name (get core/output-category->command-name output-category)]
    (if command-name
      (add-output-sidebar-message! {:command/name command-name
                                    :output message})
      (util/log-to-console
       :error
       (str "Cannot append output to output sidebar. No outputCategory matches \"" output-category "\"")))))

(defn ^:export append-stacktrace
  [^js stacktrace]
  (add-output-sidebar-message!
   {:command/name "show-stdout"
    :output (core/stacktrace->message (js->clj stacktrace :keywordize-keys true))}))

(defn ^:export clear-output-sidebar
  []
  (reset! output-sidebar-log [])
  (when @output-sidebar-webview-view
    (core/post-message-to-webview @output-sidebar-webview-view {:command/name "clear-output-view"})))
