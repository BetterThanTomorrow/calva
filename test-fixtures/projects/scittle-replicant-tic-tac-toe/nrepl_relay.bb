(ns nrepl-relay
  (:require [sci.nrepl.browser-server :as nrepl]))

(when (= *file* (System/getProperty "babashka.file"))
  (nrepl/start! {:nrepl-port 1339 :websocket-port 1340}))