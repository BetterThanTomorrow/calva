(ns calva.repl.input.messages
  "Takes the messages that the REPL Inputs in the Output views post."
  (:require
   [calva.repl.input.complete :as complete]
   [calva.repl.input.config :as config]
   [calva.repl.input.evaluate :as evaluate]
   [calva.repl.input.evaluations :as evaluations]
   [calva.repl.input.host :as host]
   [calva.repl.input.records :as records]
   [calva.repl.input.reveal :as reveal]))

(def focus-message {:command/name "repl-input-focus"})

(defn- mounted!
  "Posts the context line, the history and the evaluation bar to the REPL Input `id`, and gives its stdin
   input the focus when an evaluation waits there for a line from stdin. Refreshing the context already
   posts a history that changed."
  [id]
  (let [walked (:repl-input.history/walked @host/!state)]
    (host/refresh-context!)
    (host/post-to-view! id (host/context-line-message (:repl-input.context/line @host/!state)))
    (when (= walked (:repl-input.history/walked @host/!state))
      (host/post-to-view! id (host/history-message walked)))
    (host/post-to-view! id (evaluate/evaluation-message id))
    (when (evaluations/waiting-for-stdin (:repl-input/evaluations @host/!state) id)
      (host/post-to-view! id focus-message))))

(defn handle-message!
  "Takes a message the REPL Input in `webview-host` posted."
  [^js webview-host ^js message]
  (let [{:keys [command] :repl-input/keys [id] :as msg} (js->clj message :keywordize-keys true)]
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
      "repl-input-send-line" (evaluate/send-line! id (:line msg))
      "repl-input-lock" (host/lock! (:lock msg))
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
