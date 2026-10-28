(ns calva.repl.webview.core
  (:require
   [calva.repl.input.host :as input-host]
   [calva.repl.input.messages :as input-messages]
   [calva.repl.webview.greeting :as greeting]
   [calva.repl.webview.image-host :as image-host]
   [calva.repl.webview.stacktrace :as stacktrace]
   [calva.repl.webview.token-colors :as token-colors]
   [calva.util :as util]
   [clojure.string :as str]))

(defonce output-view-webview-panel (atom nil))
(defonce registered-webviews (atom #{}))
(defonce word-wrap-override (atom nil))
(defonce image-display-override (atom nil))

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

(defn get-output-views-word-wrap-setting
  []
  (if-let [vscode @util/vscode]
    (let [setting (.. ^js vscode -workspace (getConfiguration "calva") (get "outputViews.wordWrap"))]
      (case setting
        "on" true
        "off" false
        "follow-editor" (get-editor-word-wrap-setting)
        (get-editor-word-wrap-setting)))
    false))

(defn word-wrap?
  []
  (if (some? @word-wrap-override)
    @word-wrap-override
    (get-output-views-word-wrap-setting)))

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
           (when (or (.affectsConfiguration event "editor.wordWrap")
                     (.affectsConfiguration event "calva.outputViews.wordWrap"))
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

(def image-display-modes
  ["images" "raw" "images-including-remote-urls"])

(def image-display-cycle-modes
  "Modes the Cycle Output View Image Display command walks. Remote loading stays on the
   setting and on an explicit command argument."
  ["images" "raw"])

(def default-image-display
  "images")

(defn get-image-display-setting
  []
  (if-let [vscode @util/vscode]
    (let [setting (.. ^js vscode -workspace (getConfiguration "calva") (get "outputViewImageDisplay"))]
      (if (some #{setting} image-display-modes)
        setting
        default-image-display))
    default-image-display))

(defn image-display
  []
  (or @image-display-override
      (get-image-display-setting)))

(defn set-image-display-context!
  [display]
  (when-let [vscode @util/vscode]
    (.. ^js vscode -commands (executeCommand "setContext" "calva:outputViewImageDisplay" display))))

(defn post-image-display-to-all-views!
  [display]
  (run! #(post-message-to-webview % {:command/name "set-image-display"
                                     :image-display display})
        @registered-webviews))

(defn next-image-display
  [current]
  (let [n (count image-display-cycle-modes)
        idx (or (->> image-display-cycle-modes
                     (keep-indexed (fn [i mode] (when (= mode current) i)))
                     first)
                -1)]
    (if (neg? idx)
      (first image-display-cycle-modes)
      (nth image-display-cycle-modes (mod (inc idx) n)))))

(defn apply-image-display!
  [display]
  (reset! image-display-override display)
  (set-image-display-context! display)
  (post-image-display-to-all-views! display))

(defn ^:export cycle-image-display
  ([]
   (apply-image-display! (next-image-display (image-display))))
  ([display]
   (cond
     (some #{display} image-display-modes)
     (apply-image-display! display)

     (string? display)
     nil

     :else
     (apply-image-display! (next-image-display (image-display))))))

(defn create-image-display-change-listener
  []
  (when-let [vscode @util/vscode]
    (.. ^js vscode -workspace
        (onDidChangeConfiguration
         (fn [^js event]
           (when (.affectsConfiguration event "calva.outputViewImageDisplay")
             (reset! image-display-override nil)
             (let [display (image-display)]
               (set-image-display-context! display)
               (post-image-display-to-all-views! display))))))))

(defn ^:export init-image-display!
  []
  (image-host/set-image-display-fn! image-display)
  (set-image-display-context! (image-display))
  (when-let [vscode-context @util/vscode-context]
    (when-let [listener (create-image-display-change-listener)]
      (.. ^js vscode-context -subscriptions (push listener)))))

(defn get-output-views-font-scale-setting
  []
  (if-let [vscode @util/vscode]
    (let [setting (.. ^js vscode -workspace (getConfiguration "calva") (get "outputViews.fontSizeScale"))]
      (if (and (number? setting) (js/isFinite setting)) setting 1.0))
    1.0))

(defn post-font-scale-to-all-views!
  [msg]
  (run! #(post-message-to-webview % msg) @registered-webviews))

(defn ^:export increase-font-size
  []
  (post-font-scale-to-all-views! {:command/name "adjust-font-size" :delta 0.1}))

(defn ^:export decrease-font-size
  []
  (post-font-scale-to-all-views! {:command/name "adjust-font-size" :delta -0.1}))

(defn ^:export reset-font-size
  []
  (post-font-scale-to-all-views! {:command/name "reset-font-size"}))

(defn create-font-scale-change-listener
  []
  (when-let [vscode @util/vscode]
    (.. ^js vscode -workspace
        (onDidChangeConfiguration
         (fn [^js event]
           (when (.affectsConfiguration event "calva.outputViews.fontSizeScale")
             (post-font-scale-to-all-views!
              {:command/name "set-base-font-scale"
               :scale (get-output-views-font-scale-setting)})))))))

(defn ^:export init-font-size-scale!
  []
  (when-let [vscode-context @util/vscode-context]
    (when-let [listener (create-font-scale-change-listener)]
      (.. ^js vscode-context -subscriptions (push listener)))))

(def highlight-js-code-theme-stylesheet-data
  "The highlight.js stylesheet of each code theme, as its path under `repl-output-ui/css`."
  [["dark" ["vendor" "highlight.js" "github-dark.min.css"]]
   ["light" ["vendor" "highlight.js" "github.min.css"]]
   ["high-contrast" ["vendor" "highlight.js" "base16" "windows-high-contrast.min.css"]]
   ["high-contrast-light" ["vendor" "highlight.js" "base16" "windows-high-contrast-light.min.css"]]])

(def copy-button-stylesheet
  "The path under `repl-output-ui/css` of the highlight.js copy button plugin's stylesheet."
  ["vendor" "highlightjs-copy" "highlightjs-copy.min.css"])

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
  [code-theme code-theme-stylesheets]
  (str/join "\n" (map #(highlight-js-code-theme-stylesheet-link code-theme %)
                       code-theme-stylesheets)))

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

(defn repl-input-html
  [{:repl-input/keys [id enabled?]}]
  (str "<div id=\"repl-input\" data-repl-input-id=\"" id "\" data-repl-input-enabled=\"" (boolean enabled?) "\"></div>"))

(defn get-webview-html
  [{:env/keys [is-debug]} {:keys [js-source css-href code-theme-stylesheets copy-button-css-href csp-source code-theme greeting-html word-wrap? font-scale image-display script-nonce repl-input]}]
  (str "
<!DOCTYPE html>
<html lang=\"en\" style=\"--calva-output-font-scale: " (or font-scale 1.0) ";\">
  <head>
    <meta charset=\"UTF-8\" />

    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />

    <meta http-equiv=\"Content-Security-Policy\"
          content=\"default-src 'none';
                    img-src data: https: http: " csp-source ";
                    style-src " csp-source " 'nonce-" script-nonce "';
                    script-src " (when is-debug "'unsafe-eval' ") "'nonce-" script-nonce "';
                    " (when is-debug "connect-src ws://localhost:*;") "
                    base-uri 'none';
                    form-action 'none';\">

    <title>REPL Output</title>

    <link rel=\"stylesheet\" href=\"" css-href "\" />

" (highlight-js-code-theme-stylesheet-links code-theme code-theme-stylesheets) "

    <link
      rel=\"stylesheet\"
      href=\"" copy-button-css-href "\"
    />

  </head>
  <body" (when word-wrap? " class=\"word-wrap\"") " data-image-display=\"" (or image-display default-image-display) "\">
    " greeting-html "
    <div id=\"output\" class=\"output-element-container\"></div>
    " (when repl-input (repl-input-html repl-input)) "

    <script nonce=\"" script-nonce "\" src=\"" js-source "\"></script>
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
  "Returns the uri of the stylesheet at the path `stylesheet` under `repl-output-ui/css`."
  [{:keys [vscode/vscode]
    vscode-context :vscode/context}
   stylesheet]
  (let [^js uri (.-Uri ^js vscode)]
    (.apply (.-joinPath uri) uri (into-array (concat [(.-extensionUri ^js vscode-context) "repl-output-ui" "css"]
                                                     stylesheet)))))

(defn- stylesheet-href
  [context ^js webview-panel stylesheet]
  (.. webview-panel -webview (asWebviewUri (get-css-path context stylesheet))))

(defn set-webview-html!
  [context
   {:keys [^js webview-panel view-kind]
    :or {view-kind :output-view}}]
  (let [js-source (get-js-source context {:webview-panel webview-panel})
        css-href (stylesheet-href context webview-panel ["main.css"])
        csp-source (.. ^js webview-panel -webview -cspSource)
        script-nonce (.randomUUID (js/require "crypto"))
        logo-href (greeting/logo-webview-uri context (.-webview webview-panel))
        greeting-html (greeting/html-for-view view-kind logo-href)
        webview-html (get-webview-html context {:js-source js-source
                                                :css-href css-href
                                                :code-theme-stylesheets (mapv (fn [[theme stylesheet]]
                                                                                [theme (stylesheet-href context webview-panel stylesheet)])
                                                                              highlight-js-code-theme-stylesheet-data)
                                                :copy-button-css-href (stylesheet-href context webview-panel copy-button-stylesheet)
                                                :csp-source csp-source
                                                :script-nonce script-nonce
                                                :code-theme (code-theme-from-context context)
                                                :greeting-html greeting-html
                                                :word-wrap? (word-wrap?)
                                                :font-scale (get-output-views-font-scale-setting)
                                                :image-display (image-display)
                                                :repl-input (input-host/html-state (name view-kind))})]
    (set! (.. webview-panel -webview -html) webview-html)))

(defn set-code-theme!
  "Takes a context, a webview panel and a vscode.ColorThemeKind enum value and sets the code theme in the webview based
   on the given color theme kind, with the code colors of the active color theme."
  [{:keys [vscode/vscode]} {:keys [color-theme-kind webview-panel]}]
  (let [color-theme-kind-enum (.. ^js vscode -ColorThemeKind)
        code-theme (code-theme-for-kind color-theme-kind-enum color-theme-kind)]
    (if code-theme
      (post-message-to-webview webview-panel {:command/name "set-code-theme"
                                              :code-theme code-theme
                                              :token-colors (token-colors/active-theme-hljs-colors color-theme-kind)})
      (util/log-to-console
       :error
       "Cannot set code theme in output webview. There is no code theme set for the ColorThemeKind enum value of"
       color-theme-kind))))

(defn post-code-theme-to-all-views!
  [context color-theme-kind]
  (run! #(set-code-theme! context {:color-theme-kind color-theme-kind
                                   :webview-panel %})
        @registered-webviews))

(defn create-color-theme-change-listener
  [{:keys [^js vscode/vscode] :as context}]
  (.. vscode -window
      (onDidChangeActiveColorTheme
       (fn [e]
         ;; Ensure syntax highlighting is not broken after the output view is moved into or out of the main
         ;; VS Code window. See https://github.com/BetterThanTomorrow/calva/issues/2895.
         ;; This is probably called more frequently than it needs to be, but if that's problematic we can try to
         ;; figure out how to identify when this event means the output view moved into or out of the main window.
         ;; This event fires for more cases than just that, such as when it's focused or unfocused.
         (post-code-theme-to-all-views! context (.. e -kind))))))

(defn create-token-color-customizations-change-listener
  [{:keys [^js vscode/vscode] :as context}]
  (.. vscode -workspace
      (onDidChangeConfiguration
       (fn [^js event]
         (when (.affectsConfiguration event "editor.tokenColorCustomizations")
           (post-code-theme-to-all-views! context (.. vscode -window -activeColorTheme -kind)))))))

(defn create-extensions-change-listener
  [{:keys [^js vscode/vscode]}]
  (.. vscode -extensions (onDidChange (fn [_] (token-colors/clear-theme-token-colors!)))))

(defn ^:export init-code-theme!
  []
  (let [context {:vscode/vscode @util/vscode}]
    (when-let [^js vscode-context @util/vscode-context]
      (.. vscode-context -subscriptions (push (create-color-theme-change-listener context)))
      (.. vscode-context -subscriptions (push (create-token-color-customizations-change-listener context)))
      (.. vscode-context -subscriptions (push (create-extensions-change-listener context))))))

(defn create-view-state-change-listener
  [{:keys [^js vscode/vscode] :as context}
   {:keys [^js webview-panel]}]
  (.. webview-panel
      (onDidChangeViewState
       (fn [^js _event]
         (input-host/view-state-changed! "output-view" (.-visible webview-panel) (.-active webview-panel))
         (set-code-theme! context
                          {:color-theme-kind (.. ^js vscode -window -activeColorTheme -kind)
                           :webview-panel webview-panel})))))

(defn add-subscriptions!
  [{vscode-context :vscode/context
    :as context}
   {:keys [webview-panel]}]
  (.. ^js vscode-context -subscriptions (push (create-view-state-change-listener context {:webview-panel webview-panel}))))

(defn add-listeners!
  [^js webview-panel]
  (let [ws-folders-disposable (image-host/listen-for-workspace-folder-changes! webview-panel)]
    (.. webview-panel
        (onDidDispose
         (fn []
           (when ws-folders-disposable
             (.dispose ^js ws-folders-disposable))
           (dispose-repl-output-webview-panel output-view-webview-panel)
           (unregister-webview! webview-panel)
           (input-host/view-disposed! "output-view"))))))

(defn initialize-webview-panel
  [context ^js webview-panel]
  (register-webview! webview-panel)
  (image-host/listen-for-webview-messages! webview-panel)
  (input-messages/listen-for-messages! webview-panel)
  (add-listeners! webview-panel)
  (add-subscriptions! context {:webview-panel webview-panel})
  (set-webview-html! context {:webview-panel webview-panel})
  webview-panel)

(defn create-repl-output-webview-panel
  [{:keys [vscode/vscode] :as context}]
  (let [webview-panel (.. ^js vscode -window
                          (createWebviewPanel
                           "calva.output-view"
                           (input-host/view-title "output-view")
                           #js {:preserveFocus true
                                :viewColumn (.. ^js vscode -ViewColumn -Beside)}
                           (let [^js opts (image-host/webview-options "calva.showReplOutputView")]
                             (set! (.-retainContextWhenHidden opts) true)
                             (set! (.-enableFindWidget opts) true)
                             opts)))]
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
    (let [who (or (and (map? options) (or (:meta/who options) (:who options)))
                  (and (some? options) (.-who options)))
          ns (or (and (map? options) (or (:meta/ns options) (:ns options)))
                 (and (some? options) (.-ns options)))
          repl-session-key (or (and (map? options) (or (:meta/repl-session-key options)
                                                       (:meta/repl-session-type options)
                                                       (:replSessionKey options)
                                                       (:replSessionType options)
                                                       (:repl-session-key options)
                                                       (:repl-session-type options)))
                               (and (some? options) (or (.-replSessionKey options) (.-replSessionType options))))
          shadow-build (or (and (map? options) (or (:meta/shadow-build options)
                                                   (:shadowBuild options)
                                                   (:shadow-build options)))
                           (and (some? options) (.-shadowBuild options)))
          shadow-runtime-id (or (and (map? options) (or (:meta/shadow-runtime-id options)
                                                        (:shadowRuntimeId options)
                                                        (:shadow-runtime-id options)))
                                (and (some? options) (.-shadowRuntimeId options)))]
      (cond-> {}
        who (assoc :meta/who who)
        ns (assoc :meta/ns ns)
        repl-session-key (assoc :meta/repl-session-key repl-session-key)
        shadow-build (assoc :meta/shadow-build shadow-build)
        (some? shadow-runtime-id) (assoc :meta/shadow-runtime-id shadow-runtime-id)))))

(defn output-message
  "Returns the message that shows `message` with `command-name`, for output of `output-category` with `options`."
  [options command-name output-category message]
  (let [meta-data (options->meta options)]
    (cond-> {:command/name command-name
             :output-category output-category
             :output message}
      (seq meta-data) (assoc :meta meta-data))))

(defn ^:export append
  [^js options message]
  (let [output-category (if (map? options) (:outputCategory options) (.-outputCategory options))
        command-name (get output-category->command-name output-category)]
    (if command-name
      (post-message-to-webview (ensure-output-view-panel) (output-message options command-name output-category message))
      (util/log-to-console
       :error
       (str "Cannot append output to output webview. No outputCategory matches \"" output-category "\"")))))

(defn- causes-data
  [^js causes]
  (mapv stacktrace/cause-data (js->clj causes :keywordize-keys true)))

(defn error-message
  "Returns the message that shows the error `text` and its `causes`, a JS array of cider-nrepl cause
   messages or nil when they come later, as the Output view entry `error-id`. `options` are those
   of `append`, plus `unfolded`."
  [^js options text ^js causes error-id]
  (let [category (if (map? options) (:outputCategory options) (.-outputCategory options))
        unfolded? (if (map? options) (:unfolded options) (.-unfolded options))
        meta-data (options->meta options)]
    (cond-> {:command/name "show-error"
             :error/text text
             :error/category category
             :error/causes (causes-data causes)
             :error/unfolded? (boolean unfolded?)}
      error-id (assoc :id error-id)
      (seq meta-data) (assoc :meta meta-data))))

(defn causes-message
  "Returns the message that gives the Output view entry `error-id` its `causes`."
  [error-id ^js causes]
  {:command/name "show-error-causes"
   :error/id error-id
   :error/causes (causes-data causes)})

(defn ^:export append-error
  [^js options text ^js causes error-id]
  (post-message-to-webview (ensure-output-view-panel) (error-message options text causes error-id)))

(defn ^:export attach-error-causes
  "Gives the entry `error-id` its `causes`, unless the Output View was closed in the meantime."
  [error-id ^js causes]
  (post-message-to-webview @output-view-webview-panel (causes-message error-id causes)))

(defn ^:export clear-output-view
  []
  (when-let [webview-panel @output-view-webview-panel]
    (post-message-to-webview webview-panel {:command/name "clear-output-view"})))
