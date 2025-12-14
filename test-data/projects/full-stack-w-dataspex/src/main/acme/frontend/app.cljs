(ns acme.frontend.app
  (:require [acme.frontend.views :as views]
            [dataspex.core :as dataspex]
            [replicant.dom :as r]))

(defonce !client-state (atom {:app/client-counter 0}))

(comment
  (swap! !client-state assoc :app/hello :world)
  (swap! !client-state update :app/client-counter inc)
  :rcf)

(defn- dispatch! [_replicant-data [action-type & _args]]
  (println "_replicant-data" _replicant-data)
  (case action-type
    :client/increment
    (swap! !client-state update :app/client-counter inc)

    :server/sync
    (let [client-counter (:app/client-counter @!client-state)]
      (-> (js/fetch "/api/sync"
                    #js {:method "POST"
                         :headers #js {"Content-Type" "application/json"}
                         :body (str client-counter)})
          (.then #(.json %))
          (.then #(js->clj % :keywordize-keys true))
          (.then #(swap! !client-state assoc :app/last-known-server-counter (:server-counter %)))
          (.catch #(js/console.error "Failed to sync to server:" %))))

    :server/fetch
    (-> (js/fetch "/api/counter")
        (.then #(.json %))
        (.then #(js->clj % :keywordize-keys true))
        (.then #(:server-counter %))
        (.then #(swap! !client-state assoc :app/last-known-server-counter %))
        (.catch #(js/console.error "Failed to fetch server counter:" %)))

    (js/console.warn "Unknown action:" action-type)))

(defn ^:dev/after-load render! []
  (r/render (js/document.getElementById "root")
            (views/app @!client-state)))

(defn ^:export init! []
  (println "Hello World - Replicant Edition")
  (dataspex/inspect "!client-state" !client-state)
  (r/set-dispatch! #'dispatch!)
  (add-watch !client-state :render
             (fn [_k _r _o _n] (render!)))
  (render!)
  (dispatch! nil [:server/fetch]))