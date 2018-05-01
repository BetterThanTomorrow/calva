(ns calva.extension
  (:require ["./extension" :as js-ext]))

(js/console.log "CALVA LOADED!")

;; this file is only required because the :node-library :exports config needs a CLJS namespace

(defn exports []
  #js {:activate js-ext/activate
       :deactivate js-ext/deactivate})
