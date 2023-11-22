(ns calva.repl.webview-output
  (:require [calva.util :as util]
            ["fs" :as fs]
            ["path" :as path]))

(def repl-output-webview-panel (atom nil))

(defn dispose-repl-output-webview-panel []
  (println "Disposing repl-output-webview-panel")
  (reset! repl-output-webview-panel nil))

(defn create-repl-output-webview-panel []
  (or @repl-output-webview-panel
      (let [webview-panel (.. @util/vscode -window (createWebviewPanel "calva:repl-output"
                                                                       "REPL Output"
                                                                       (.. @util/vscode -ViewColumn -Two)
                                                                       #js {:enableScripts true}))]
        (.. webview-panel (onDidDispose dispose-repl-output-webview-panel))
        (reset! repl-output-webview-panel webview-panel))))

(defn get-webview-html-path []
  (.. path (join (.. @util/context -extensionPath) "assets" "repl-output-webview.html")))

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
    <img src=\"https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif\" width=\"300\" />

    <pre><code class=\"language-clojure\">
(defn hello-world [] (println \"highlightjs code block\"))
    </code></pre>

    <pre>
      <code class=\"language-clojure\">
(defn hello-world [] (println \"highlightjs code block\"))
      </code>
    </pre>

    <!-- TODO: Disable inline scripts - see security section in webview docs -->
    <div id=\"results\"></div>

    <script>
      window.addEventListener('message', (event) => {
        const message = event.data; // The JSON data our extension sent
        const resultsDiv = document.getElementById('results');

        switch (message.command) {
          case 'print-result':
            const resultParagraph = document.createElement('p');
            const text = document.createTextNode(message.result);
            resultParagraph.appendChild(text);
            resultsDiv.appendChild(resultParagraph);
            break;
          case 'clear-results':
            resultsDiv.innerHTML = '';
            break;
        }
      });
    </script>
    <script src=\"" js-src "\"></script>
  </body>
</html>"))

(defn get-webview-content []
  (.. fs (readFileSync (get-webview-html-path)
                       "utf-8")))

(defn post-message-to-webview [message]
  (.. @repl-output-webview-panel
      -webview
      (postMessage (clj->js message))))

(defn main [])

;; TODO: See if can send repl output to webview when it's hidden and see it once unhidden
;; "You cannot send messages to a hidden webview, even when retainContextWhenHidden is enabled."
;; https://code.visualstudio.com/api/extension-guides/webview#theming-webview-content

(comment
  (create-repl-output-webview-panel)

  @(def js-path (.. @util/vscode -Uri (joinPath (.. @util/context -extensionUri) "assets" "js" "repl-output-webview.js")))

  @(def js-src (.. @repl-output-webview-panel -webview (asWebviewUri js-path)))

  (set! (.. @repl-output-webview-panel -webview -html) (get-webview-html js-src))

  (post-message-to-webview {:command "print-result"
                            :result "Hello world!!!"})

  (post-message-to-webview {:command "clear-results"})

  @repl-output-webview-panel

  ;; TODO: Don't worry about scrolling yet. We know we can do that. Explore other important unknowns first.

  :rcf)
