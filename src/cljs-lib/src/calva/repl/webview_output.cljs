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
                                                                       2))]
        (.. webview-panel (onDidDispose dispose-repl-output-webview-panel))
        (reset! repl-output-webview-panel webview-panel))))

(defn get-webview-html-path []
  (.. path (join (.. @util/context -extensionPath) "assets" "repl-output-webview.html")))

(defn get-webview-content []
  (.. fs (readFileSync (get-webview-html-path)
                       "utf-8")))

;; TODO: See if can send repl output to webview when it's hidden and see it once unhidden
;; "You cannot send messages to a hidden webview, even when retainContextWhenHidden is enabled."
;; https://code.visualstudio.com/api/extension-guides/webview#theming-webview-content

(comment
  (create-repl-output-webview-panel)

  (set! (.. @repl-output-webview-panel -webview -html) (get-webview-content))

  @repl-output-webview-panel

  :rcf)
