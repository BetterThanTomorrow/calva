(ns db
  (:require [cljs.test]))

(def !state (atom {:running nil
                   :ws-activated? false
                   :pass 0
                   :fail 0
                   :error 0}))

