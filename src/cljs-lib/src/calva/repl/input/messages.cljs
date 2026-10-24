(ns calva.repl.input.messages
  "Takes the messages that the REPL Inputs in the Output views post."
  (:require
   [calva.repl.input.complete :as complete]
   [calva.repl.input.config :as config]
   [calva.repl.input.evaluate :as evaluate]
   [calva.repl.input.host :as host]
   [calva.repl.input.recall :as recall]
   [calva.repl.input.records :as records]
   [calva.repl.input.reveal :as reveal]))

(defn- mounted!
  [id]
  (host/refresh-context!)
  (host/post-to-view! id (host/context-line-message (:repl-input.context/line @host/!state)))
  (host/post-to-view! id (evaluate/evaluation-message id)))

(defn handle-message!
  "Takes a message the REPL Input in `webview-host` posted."
  [^js webview-host ^js message]
  (let [{:keys [command direction] :repl-input/keys [id] :as msg} (js->clj message :keywordize-keys true)]
    (case command
      "repl-input-mounted" (do (swap! host/!views assoc id webview-host)
                               (host/take-record! records/take-mount msg)
                               (mounted! id)
                               (host/load-keybindings!))
      "repl-input-changed" (host/take-record! records/take-change msg)
      "repl-input-unmounted" (do (host/update-records! records/remove-record id)
                                 (host/update-focus! [:unmount id]))
      "repl-input-focused" (host/update-focus! [:focus id])
      "repl-input-blurred" (host/update-focus! [:blur id])
      "repl-input-resized" (config/store-height! msg)
      "repl-input-follow-editor" (host/follow-editor!)
      "repl-input-interrupt" (evaluate/interrupt! id)
      "repl-input-walk-history" (recall/walk! id (keyword direction))
      "repl-input-complete" (complete/complete! msg)
      "repl-input-resolve-completion" (complete/resolve! msg)
      "repl-input-completion-active" (complete/active-changed! msg)
      "repl-input-reveal-definition" (reveal/reveal-definition! msg)
      nil)))

(defn listen-for-messages!
  [^js webview-host]
  (when-let [webview (some-> webview-host .-webview)]
    (when (fn? (.-onDidReceiveMessage webview))
      (.onDidReceiveMessage webview #(handle-message! webview-host %)))))
