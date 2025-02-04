(ns calva.repl.webview.core
  (:require
   [calva.util :as util]))

(defonce repl-output-webview-panel (atom nil))

(defn dispose-repl-output-webview-panel []
  (println "Disposing repl-output-webview-panel")
  (reset! repl-output-webview-panel nil))

;; TODO: See if there's a way to not have to use ^js in so many places without shadow-cljs warnings
(defn create-or-get-repl-output-webview-panel []
  (or @repl-output-webview-panel
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
                                    :retainContextWhenHidden true}))]
        (.. ^js webview-panel (onDidDispose dispose-repl-output-webview-panel))
        (reset! repl-output-webview-panel webview-panel))))

(defn get-webview-html
  [js-src]
  (str "
<!DOCTYPE html>
<html lang=\"en\">
  <head>
    <meta charset=\"UTF-8\" />

    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />

    <!-- TODO: Uncomment this and lock it down as much as possible. Remember to disable things that default-src does not. See bottom of this section: https://web.dev/articles/csp#resource-options -->
    <!-- <meta http-equiv=\"Content-Security-Policy\"
        content=\"default-src 'none';
                  style-src https://cdnjs.cloudflare.com;
                  script-src https://cdnjs.cloudflare.com;\"> -->

    <title>REPL Output</title>

    <link
      rel=\"stylesheet\"
      href=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css\"
    />

    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js\"></script>
    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/clojure.min.js\"></script>

  </head>
  <body>
    <!-- TODO: Disable inline scripts - see security section in webview docs -->
    <div id=\"output\"></div>

    <script src=\"" js-src "\"></script>
  </body>
</html>"))

(defn post-message-to-webview [message]
  (let [webview-panel ^js @repl-output-webview-panel]
    (when webview-panel
      (.. webview-panel
          -webview
          (postMessage (clj->js (merge
                                 {:id (str (random-uuid))} ;; Provide an id if one wasn't provided by the caller
                                 message)))))))

(defn show-repl-output-webview-panel []
  (let [^js repl-output-webview-panel (create-or-get-repl-output-webview-panel)
        js-path (.. ^js @util/vscode
                    -Uri
                    (joinPath (.. ^js @util/context -extensionUri) "repl-output-ui" "js" "main.js"))
        js-src (.. repl-output-webview-panel -webview (asWebviewUri js-path))
        webview-html (get-webview-html js-src)]
    (set! (.. ^js repl-output-webview-panel -webview -html) webview-html)))

;; TODO: Add tests
;; TODO: Refactor this to use a mapping of output category -> command name
(defn append
  [^js options message]
  (let [output-category (.-outputCategory options)]
    (case output-category
      "otherOut" (post-message-to-webview {:command-name "show-stdout"
                                           :content message})
      "evalOut" (post-message-to-webview {:command-name "show-stdout"
                                          :content message})
      "evalResults" (post-message-to-webview {:command-name "show-result"
                                              :content message})
      (js/console.error
       (str "Cannot append content to output webview. No outputCategory matches \"" output-category "\"")))))

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
