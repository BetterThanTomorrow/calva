(ns calva.repl.webview.core
  (:require
   [calva.repl.input.brackets :as brackets]
   [calva.repl.input.command-keys :as command-keys]
   [calva.repl.input.config :as config]
   [calva.repl.input.highlighting :as highlighting]
   [calva.repl.input.host :as input-host]
   [calva.repl.input.messages :as input-messages]
   [calva.repl.input.printed-code :as printed-code]
   [calva.repl.webview.code-tokens :as code-tokens]
   [calva.repl.webview.greeting :as greeting]
   [calva.repl.webview.html :as html]
   [calva.repl.webview.image-host :as image-host]
   [calva.repl.webview.output-messages :as output-messages]
   [calva.repl.webview.printed-brackets :as printed-brackets]
   [calva.repl.webview.styles :as styles]
   [calva.repl.webview.token-colors :as token-colors]
   [calva.trail :as trail]
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
  "The image display modes, in the order the Cycle Output View Image Display command walks them."
  ["images" "images-including-remote-urls" "raw"])

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
  (let [n (count image-display-modes)
        idx (or (->> image-display-modes
                     (keep-indexed (fn [i mode] (when (= mode current) i)))
                     first)
                -1)]
    (if (neg? idx)
      (first image-display-modes)
      (nth image-display-modes (mod (inc idx) n)))))

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

;; The connect-src and unsafe-eval are only needed in development mode for the shadow-cljs
;; dev workflow to function properly

(defn- content-security-policy
  [is-debug csp-source script-nonce]
  (str/join " " (cond-> ["default-src 'none';"
                         (str "img-src data: https: http: " csp-source ";")
                         (str "style-src " csp-source " 'nonce-" script-nonce "';")
                         (str "script-src " (when is-debug "'unsafe-eval' ") "'nonce-" script-nonce "';")]
                  is-debug (conj "connect-src ws://localhost:*;")
                  :always (conj "base-uri 'none';" "form-action 'none';"))))

(defn repl-input-element
  "Returns the element the REPL Input mounts in, with its view id and whether it is on."
  [{:repl-input/keys [id enabled?]}]
  [:div {:id "repl-input" :data-repl-input-id id :data-repl-input-enabled (str (boolean enabled?))}])

(defn page
  "Returns the page of an Output view, as hiccup."
  [{:env/keys [is-debug]} {:keys [js-source styles csp-source greeting word-wrap? font-scale image-display script-nonce repl-input]}]
  [:html {:lang "en" :style {:--calva-output-font-scale (str (or font-scale 1.0))}}
   [:head
    [:meta {:charset "UTF-8"}]
    [:meta {:name "viewport" :content "width=device-width, initial-scale=1.0"}]
    [:meta {:http-equiv "Content-Security-Policy"
            :content (content-security-policy is-debug csp-source script-nonce)}]
    [:title "REPL Output"]
    [:style {:id "calva-output-styles" :nonce script-nonce :innerHTML styles}]]
   [:body (cond-> {:data-image-display (or image-display default-image-display)}
            word-wrap? (assoc :class "word-wrap"))
    [:div {:id "output-scroller" :tabindex "-1"}
     greeting
     [:div {:id "output" :class "output-element-container"}]
     [:div {:id "output-end" :aria-hidden "true"}]]
    (when repl-input (repl-input-element repl-input))
    [:script {:nonce script-nonce :src (str js-source)}]]])

(defn get-js-source
  [{:keys [vscode/vscode]
    vscode-context :vscode/context}
   {:keys [^js webview-panel]}]
  (let [extension-uri (.. ^js vscode-context -extensionUri)
        js-path (.. ^js vscode -Uri (joinPath extension-uri "repl-output-ui" "js" "main.js"))]
    (.. ^js webview-panel -webview (asWebviewUri js-path))))

(defn set-webview-html!
  [context
   {:keys [^js webview-panel view-kind]
    :or {view-kind :output-view}}]
  (let [js-source (get-js-source context {:webview-panel webview-panel})
        csp-source (.. ^js webview-panel -webview -cspSource)
        script-nonce (.randomUUID (js/require "crypto"))
        logo-href (greeting/logo-webview-uri context (.-webview webview-panel))
        view-page (page context {:js-source js-source
                                 :styles (styles/css)
                                 :csp-source csp-source
                                 :script-nonce script-nonce
                                 :greeting (greeting/for-view view-kind logo-href)
                                 :word-wrap? (word-wrap?)
                                 :font-scale (get-output-views-font-scale-setting)
                                 :image-display (image-display)
                                 :repl-input (input-host/html-state (name view-kind))})]
    (set! (.. webview-panel -webview -html) (html/document view-page))))

(defn set-code-theme!
  "Posts the webview `webview-panel` the colors of the active color theme of `color-theme-kind` that printed
   code needs: the key of its palette, whether the grammar is loaded and the bracket settings, which tells
   when its code needs coloring again, the bracket styles, and its color for function names, which stack
   frames take."
  [_context {:keys [color-theme-kind webview-panel]}]
  (let [palette (token-colors/active-theme-palette color-theme-kind)
        settings (printed-brackets/settings)]
    (post-message-to-webview webview-panel {:command/name "set-code-theme"
                                            :output/palette-key (hash [palette (some? @highlighting/!grammar) (brackets/rainbow-options settings)])
                                            :output/bracket-styles (brackets/bracket-styles settings)
                                            :output/frame-name-color (highlighting/scope-color (:palette/token-rules palette)
                                                                                               ["entity.name.function.clojure"])})))

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
         (when (some #(.affectsConfiguration event %) ["editor.tokenColorCustomizations"
                                                       "editor.semanticTokenColorCustomizations"
                                                       "editor.semanticHighlighting"
                                                       "calva.highlight"])
           (post-code-theme-to-all-views! context (.. vscode -window -activeColorTheme -kind)))))))

(defn create-extensions-change-listener
  [{:keys [^js vscode/vscode]}]
  (.. vscode -extensions (onDidChange (fn [_] (token-colors/clear-theme-token-colors!)))))

(defn- color-code-when-grammar-loads!
  "Posts every view its code colors again when the grammar loads, so code printed before is colored."
  [context]
  (add-watch highlighting/!grammar ::output-views
             (fn [_ _ before after]
               (when (and after (not before))
                 (post-code-theme-to-all-views! context (.. ^js @util/vscode -window -activeColorTheme -kind))))))

(defn ^:export init-code-theme!
  []
  (let [context {:vscode/vscode @util/vscode}]
    (when-let [^js vscode-context @util/vscode-context]
      (.. vscode-context -subscriptions (push (create-color-theme-change-listener context)))
      (.. vscode-context -subscriptions (push (create-token-color-customizations-change-listener context)))
      (.. vscode-context -subscriptions (push (create-extensions-change-listener context)))
      (color-code-when-grammar-loads! context))))

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

(defn- post-code-highlighting!
  "Posts the page in `webview-host` the highlighting of the printed code of `chunks`, a chunk at a time,
   letting other work run between the chunks."
  [^js webview-host chunks]
  (when-let [[chunk & more] (seq chunks)]
    (post-message-to-webview webview-host (output-messages/code-highlighting-message chunk))
    (when more
      (js/setTimeout #(post-code-highlighting! webview-host more) 0))))

(defn- post-semantic-tokens!
  "Posts the page in `webview-host` the semantic tokens of the printed `codes`, `[id text ns session-key]`
   each, asking clojure-lsp once for the codes of each namespace and session."
  [^js webview-host codes]
  (doseq [[[ns session-key] group] (group-by (fn [[_ _ ns session-key]] [ns session-key]) codes)]
    (-> (code-tokens/tokens+ @input-host/!adapter ns session-key (mapv (fn [[id text]] [id text]) group))
        (.then (fn [ranges]
                 (when (seq ranges)
                   (post-message-to-webview webview-host {:command/name "output-semantic-tokens"
                                                          :output/codes ranges}))))
        (.catch (fn [e]
                  (js/console.error "Failed getting semantic tokens for printed code:" e))))))

(defn listen-for-highlighting-requests!
  "Answers the page in `webview-host` when it asks for the highlighting, or the semantic tokens, of printed
   code."
  [^js webview-host]
  (when-let [webview (some-> webview-host .-webview)]
    (when (fn? (.-onDidReceiveMessage webview))
      (.onDidReceiveMessage webview (fn [^js message]
                                      (let [codes (js->clj (aget message "output/codes"))]
                                        (case (.-command message)
                                          "output-highlight" (post-code-highlighting! webview-host (output-messages/code-chunks codes))
                                          "output-semantic-tokens" (post-semantic-tokens! webview-host codes)
                                          nil)))))))

(defn- post-keybindings-note!
  "Reads the user's keybindings and posts the greeting's note about their custom keybindings for the Output
   views to each of the `webview-hosts`."
  [webview-hosts]
  (when-let [vscode-context @util/vscode-context]
    (.then (config/read-user-keybindings+ vscode-context)
           (fn [user-keybindings]
             (let [message {:command/name "keybindings-note"
                            :keybindings-note/custom (command-keys/output-views-custom-keybindings
                                                      (config/manifest-keybindings vscode-context)
                                                      user-keybindings)}]
               (run! #(post-message-to-webview % message) webview-hosts))))))

(defn- page-loaded!
  [^js webview-host view-id]
  (trail/log! (str view-id " page loaded"))
  (printed-code/forget! view-id)
  (post-message-to-webview webview-host (input-host/enabled-message view-id))
  (post-keybindings-note! [webview-host]))

(defn listen-for-page-loaded!
  "Each time the page in `webview-host`, the Output view `view-id`, has loaded, logs a trail line, forgets the
   printed code of the page before, posts the page whether the REPL Input is on, which the page misses when
   the setting changed before it listened, and the greeting's note about the user's keybindings. When the
   page asks to read the keybindings again, reads them for the REPL Inputs and printed code, and posts the
   note to every view."
  [^js webview-host view-id]
  (when-let [webview (some-> webview-host .-webview)]
    (when (fn? (.-onDidReceiveMessage webview))
      (.onDidReceiveMessage webview (fn [^js message]
                                      (case (.-command message)
                                        "page-loaded" (page-loaded! webview-host view-id)
                                        "read-keybindings-again" (do (input-host/load-keybindings!)
                                                                     (post-keybindings-note! @registered-webviews))
                                        nil))))))

(defn initialize-webview-panel
  [context ^js webview-panel]
  (register-webview! webview-panel)
  (image-host/listen-for-webview-messages! webview-panel)
  (input-messages/listen-for-messages! webview-panel)
  (listen-for-page-loaded! webview-panel "output-view")
  (listen-for-highlighting-requests! webview-panel)
  (add-listeners! webview-panel)
  (add-subscriptions! context {:webview-panel webview-panel})
  (set-webview-html! context {:webview-panel webview-panel})
  webview-panel)

(defn create-repl-output-webview-panel
  [{:keys [vscode/vscode] :as context}]
  (trail/log! (str "output-view created, REPL Input " (input-host/on-or-off "output-view")))
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

(defn ^:export append
  [^js options message]
  (let [output-category (if (map? options) (:outputCategory options) (.-outputCategory options))
        command-name (get output-messages/output-category->command-name output-category)]
    (if command-name
      (post-message-to-webview (ensure-output-view-panel) (output-messages/output-message options command-name output-category message))
      (util/log-to-console
       :error
       (str "Cannot append output to output webview. No outputCategory matches \"" output-category "\"")))))

(defn ^:export append-error
  [^js options text ^js causes error-id]
  (post-message-to-webview (ensure-output-view-panel) (output-messages/error-message options text causes error-id)))

(defn ^:export attach-error-causes
  "Gives the entry `error-id` its `causes`, unless the Output View was closed in the meantime."
  [error-id ^js causes]
  (post-message-to-webview @output-view-webview-panel (output-messages/causes-message error-id causes)))

(defn ^:export end-evaluation
  "Tells the Output View, unless it was closed in the meantime, that the evaluation `evaluation-id` ended."
  [evaluation-id]
  (post-message-to-webview @output-view-webview-panel (output-messages/evaluation-ended-message evaluation-id)))

(defn ^:export clear-output-view
  []
  (when-let [webview-panel @output-view-webview-panel]
    (post-message-to-webview webview-panel {:command/name "clear-output-view"})))
