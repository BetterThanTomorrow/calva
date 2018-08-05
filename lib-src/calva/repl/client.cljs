(ns calva.repl.client
  (:require
   [calva.repl.nrepl :as nrepl]))

(defn- send [msg callback]
  (this-as this
           (nrepl/message this msg callback)))

(defn ^:export create [options ^js state]
  (let [options (js->clj options :keywordize-keys true)
        options (if (.get state "connected")
                  {:host (.get state "hostname")
                   :port (.get state "port")}
                  options)]
    (when options
      (let [con (nrepl/connect options)]
        (set! (.-send con) (.bind send con))
        con))))
