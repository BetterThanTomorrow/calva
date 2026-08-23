(ns tasks
  (:require [sci.nrepl.browser-server :as bp]))

(defn browser-nrepl
  "Start browser nREPL"
  [{:keys [nrepl-port websocket-port]
    :or {nrepl-port 1339
         websocket-port 1340}}]
  (bp/start! {:nrepl-port nrepl-port :websocket-port websocket-port})
  (deref (promise)))

(comment
  (browser-nrepl {:nrepl-port 1339 :websocket-port 1340})
  :rcf)

