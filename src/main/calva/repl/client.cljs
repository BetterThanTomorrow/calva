(ns calva.repl.client
  (:require
   ["/calva/state.js" :as state]
   [calva.repl.nrepl :as nrepl]))

(defn send [msg callback]
  (this-as this
           (nrepl/message this msg callback)))

(defn create [options]
  (let [current (state/deref)
        options (js->clj options :keywordize-keys true)
        options (if (.get current "connected")
                  {:host (.get current "hostname")
                   :port (.get current "port")}
                  options)]
    (when options
      (let [con (nrepl/connect options)]
        (set! (.-send con) (.bind send con))
        con))))
