(ns calva.repl.input.core
  "Turns the REPL Input on and off in the Output views, from the setting."
  (:require
   [calva.repl.input.config :as config]
   [calva.repl.input.host :as host]
   [calva.repl.input.recall :as recall]
   [calva.repl.input.reveal :as reveal]
   [calva.repl.webview.core :as webview]
   [calva.repl.webview.sidebar :as sidebar]
   [calva.trail :as trail]
   [calva.util :as util]))

(defn- apply-to-output-view!
  []
  (when-let [^js panel @webview/output-view-webview-panel]
    (set! (.-title panel) (host/view-title "output-view"))
    (webview/post-message-to-webview panel (host/enabled-message "output-view"))))

(defn- apply-to-output-sidebar!
  []
  (when-let [^js view @sidebar/output-sidebar-webview-view]
    (if (sidebar/output-sidebar-in-setting? (sidebar/current-output-destinations))
      (do
        (set! (.-title view) (host/view-title "output-sidebar"))
        (webview/post-message-to-webview view (host/enabled-message "output-sidebar")))
      (sidebar/apply-sidebar-help-or-output-log! view))))

(defn- apply-to-views!
  []
  (trail/log! (str "REPL Input setting changed: output-view " (host/on-or-off "output-view")
                   ", output-sidebar " (host/on-or-off "output-sidebar")))
  (apply-to-output-view!)
  (apply-to-output-sidebar!))

(defn- create-setting-change-listener
  []
  (.. ^js @util/vscode -workspace
      (onDidChangeConfiguration
       (fn [^js event]
         (when (.affectsConfiguration event "calva.outputViews.replInput")
           (apply-to-views!))
         (when (some #(.affectsConfiguration event %) (cons "calva" config/clojure-settings))
           (host/settings-changed! (host/read-settings)))))))

(defn- create-terminal-focus-listener
  []
  (.. ^js @util/vscode -window
      (onDidChangeActiveTerminal #(when % (host/terminal-focused!)))))

(defn ^:export init!
  "Starts the REPL Input with the adapter's functions that call Calva's TypeScript code."
  [^js adapter]
  (host/set-adapter! adapter)
  (recall/load-history!)
  (reveal/load-evaluated-code!)
  (.. ^js @util/vscode-context -subscriptions (push (create-setting-change-listener)))
  (.. ^js @util/vscode-context -subscriptions (push (create-terminal-focus-listener))))
