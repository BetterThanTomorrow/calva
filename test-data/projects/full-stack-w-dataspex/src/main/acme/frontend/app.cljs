(ns acme.frontend.app
  (:require [acme.db :as db]
            [acme.frontend.event-handler :as events]
            [acme.frontend.views :as views]
            [dataspex.core :as dataspex]
            [replicant.dom :as r]))

(defn ^:dev/after-load render! []
  (r/render (js/document.getElementById "root")
            (views/app @db/!state)))

(defn ^:export init! []
  (println "Hello World - Replicant Edition")
  (dataspex/inspect "!db/client-state" db/!state)
  (r/set-dispatch! #'events/dispatch!)
  (add-watch db/!state :render
             (fn [_k _r _o _n] (render!)))
  (render!)
  (events/dispatch! nil [:server/fetch]))