(ns acme.frontend.event-handler
  (:require [acme.db :as db]))

(defn dispatch! [_replicant-data [action-type & _args]]
  (println "_replicant-data" _replicant-data)
  (case action-type
    :client/increment
    (swap! db/!state update :app/counter inc)

    :server/set-counter
    (let [client-counter (:app/counter @db/!state)]
      (-> (js/fetch "/api/set-counter"
                    #js {:method "POST"
                         :headers #js {"Content-Type" "application/json"}
                         :body (str client-counter)})
          (.then #(.json %))
          (.then #(js->clj % :keywordize-keys true))
          (.then #(swap! db/!state assoc :app/last-known-server-counter (:server-counter %)))
          (.catch #(js/console.error "Failed to sync to server:" %))))

    :server/fetch
    (-> (js/fetch "/api/counter")
        (.then #(.json %))
        (.then #(js->clj % :keywordize-keys true))
        (.then #(:server-counter %))
        (.then #(swap! db/!state assoc :app/last-known-server-counter %))
        (.catch #(js/console.error "Failed to fetch server counter:" %)))

    (js/console.warn "Unknown action:" action-type)))