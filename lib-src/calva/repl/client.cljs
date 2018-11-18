(ns calva.repl.client
  (:require
   [calva.repl.nrepl :as nrepl]))

(defn- send [msg callback]
  (this-as this
           (nrepl/message this msg callback)))

(defn ^:export create [^js options]
  (let [options (js->clj options :keywordize-keys true)]
    (when options
      (let [con (nrepl/connect options)]
        (set! (.-send con) (.bind send con))
        con))))
