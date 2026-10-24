(ns calva.repl.input.core
  "Turns the REPL Input on and off in the Output views, from the setting and the toggle commands."
  (:require
   [calva.repl.input.host :as host]
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
  (host/set-context! enabled-context (setting/any-enabled? (host/current-setting))))

(defn- create-setting-change-listener
  []
  (.. ^js @util/vscode -workspace
      (onDidChangeConfiguration
       (fn [^js event]
         (when (.affectsConfiguration event "calva.outputViews.replInput")
           (host/clear-toggles!)
           (set-enabled-context!)
           (apply-to-views!))))))

(defn ^:export init!
  "Starts the REPL Input with the adapter's `setContext` function."
  [^js adapter]
  (host/set-set-context-fn! (.-setContext adapter))
  (set-enabled-context!)
  (.. ^js @util/vscode-context -subscriptions (push (create-setting-change-listener))))

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
