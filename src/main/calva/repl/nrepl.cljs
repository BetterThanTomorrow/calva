(ns calva.repl.nrepl
  (:require ["net" :as net]))

(defn connect
  "Connects to a socket-based REPL at the given host (defaults to localhost) and port."
  [^js options]
  (let [{:keys [host port on-connect on-error on-end] :or {host "localhost"}} (js->clj options :keywordize-keys true)]
    (doto (net/createConnection #js {:host host :port port})
      (.once "connect" (fn []
                         (js/console.log (str "Connected to " host ":" port))

                         (when on-connect
                           (on-connect))))

      (.once "end" (fn []
                     (js/console.log (str "Disconnected from " host ":" port))

                     (when on-end
                       (on-end))))

      (.once "error" (fn [error]
                       (js/console.log (str "Failed to connect to " host ":" port) error)

                       (when on-error
                         (on-error error)))))))
