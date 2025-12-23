(ns tasks
  (:require [babashka.http-server :as server]
            [sci.nrepl.browser-server :as bp]))

(defn serve
  "Serve static assets"
  [{:keys [port dir]
    :or {port 1337
         dir "."}}]
  (server/exec {:port port :dir dir}))

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

