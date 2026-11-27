(ns nrepl-server
  "Starts Babashka's nREPL server on a free port and writes the port to
   `.nrepl-port`, which `bb nrepl-server` doesn't. Removes the file on exit."
  (:require [babashka.fs :as fs]
            [babashka.nrepl.server :as server]))

(let [port (-> (server/start-server! {:host "127.0.0.1" :port 0})
               :socket
               .getLocalPort)]
  (spit ".nrepl-port" port)
  (-> (Runtime/getRuntime)
      (.addShutdownHook (Thread. (fn [] (fs/delete-if-exists ".nrepl-port")))))
  (println "nREPL server started on port" port)
  @(promise))
