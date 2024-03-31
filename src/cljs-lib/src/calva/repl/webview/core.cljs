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
      (let [webview-panel (.. ^js @util/vscode -window (createWebviewPanel "calva:repl-output"
                                                                           "REPL Output"
                                                                           (.. ^js @util/vscode -ViewColumn -Two)
                                                                           #js {:enableScripts true}))]
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
    <title>REPL Output</title>
    <link
      rel=\"stylesheet\"
      href=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css\"
    />
    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js\"></script>
    <script src=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/clojure.min.js\"></script>
    <script>
      hljs.highlightAll();
    </script>
  </head>
  <body>
    <!-- TODO: Disable inline scripts - see security section in webview docs -->
    <div id=\"output\"></div>

    <script src=\"" js-src "\"></script>
  </body>
</html>"))

(defn post-message-to-webview [message]
  (.. ^js @repl-output-webview-panel
      -webview
      (postMessage (clj->js (merge
                             {:id (str (random-uuid))} ;; Provide an id if one wasn't provided by the caller
                             message)))))

(defn show-repl-output-webview-panel []
  (let [^js repl-output-webview-panel (create-or-get-repl-output-webview-panel)
        js-path (.. ^js @util/vscode
                    -Uri
                    (joinPath (.. ^js @util/context -extensionUri) "repl-output-ui" "js" "main.js"))
        js-src (.. repl-output-webview-panel -webview (asWebviewUri js-path))]
    (set! (.. ^js repl-output-webview-panel -webview -html) (get-webview-html js-src))
    (let [interval-id (js/setInterval post-message-to-webview
                                      1000
                                      {:command-name "show-result"
                                       :result "Hello world!!!"})]
      (js/setTimeout #(js/clearInterval interval-id)
                     11000))))

;; TODO: See if can send repl output to webview when it's hidden and see it once unhidden
;; "You cannot send messages to a hidden webview, even when retainContextWhenHidden is enabled."
;; https://code.visualstudio.com/api/extension-guides/webview#theming-webview-content

(comment
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

  (post-message-to-webview {:command-name "show-result"
                            :result "send while hidden"})

  (post-message-to-webview {:command "clear-output"})

  @repl-output-webview-panel

  ;; TODO: Don't worry about scrolling yet. We know we can do that. Explore other important unknowns first.

  :rcf)
