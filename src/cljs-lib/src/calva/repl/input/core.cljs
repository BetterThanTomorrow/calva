(ns calva.repl.input.core
  "Turns the REPL Input on and off in the Output views, from the setting and the toggle commands."
  (:require
   [calva.repl.input.config :as config]
   [calva.repl.input.host :as host]
   [calva.repl.input.recall :as recall]
   [calva.repl.input.reveal :as reveal]
   [calva.repl.input.setting :as setting]
   [calva.repl.webview.core :as webview]
   [calva.repl.webview.sidebar :as sidebar]
   [calva.util :as util]))

(def enabled-context "calva:replInputEnabled")

(defn- enabled-message
  [view-id]
  {:command/name "repl-input-enabled"
   :repl-input/id view-id
   :repl-input/enabled? (host/enabled? view-id)})

(defn- apply-to-output-view!
  []
  (when-let [^js panel @webview/output-view-webview-panel]
    (set! (.-title panel) (host/view-title "output-view"))
    (webview/post-message-to-webview panel (enabled-message "output-view"))))

(defn- apply-to-output-sidebar!
  []
  (when-let [^js view @sidebar/output-sidebar-webview-view]
    (if (sidebar/output-sidebar-in-setting? (sidebar/current-output-destinations))
      (do
        (set! (.-title view) (host/view-title "output-sidebar"))
        (webview/post-message-to-webview view (enabled-message "output-sidebar")))
      (sidebar/apply-sidebar-help-or-output-log! view))))

(defn- apply-to-views!
  []
  (apply-to-output-view!)
  (apply-to-output-sidebar!))

(defn- set-enabled-context!
  []
  (host/set-context! enabled-context (setting/any-enabled? (config/current-setting))))

(defn- create-setting-change-listener
  []
  (.. ^js @util/vscode -workspace
      (onDidChangeConfiguration
       (fn [^js event]
         (when (.affectsConfiguration event "calva.outputViews.replInput")
           (host/clear-toggles!)
           (set-enabled-context!)
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
  (set-enabled-context!)
  (recall/load-history!)
  (reveal/load-evaluated-code!)
  (.. ^js @util/vscode-context -subscriptions (push (create-setting-change-listener)))
  (.. ^js @util/vscode-context -subscriptions (push (create-terminal-focus-listener))))

(defn ^:export toggle-output-view!
  []
  (host/toggle! "output-view")
  (when (host/enabled? "output-view")
    (webview/show-repl-output-webview-panel true))
  (apply-to-output-view!))

(defn ^:export toggle-output-sidebar!
  []
  (host/toggle! "output-sidebar")
  (apply-to-output-sidebar!))
