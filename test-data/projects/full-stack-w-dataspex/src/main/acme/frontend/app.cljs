(ns acme.frontend.app
  (:require [dataspex.core :as dataspex]))

(defonce !client-state (atom {:client/counter 0}))

(comment
  (swap! !client-state assoc :client/hello :world)
  (swap! !client-state update :client/counter inc)
  :rcf)

(defn ^:export fetch-server-counter! []
  (-> (js/fetch "/api/counter")
      (.then #(.json %))
      (.then #(js->clj % :keywordize-keys true))
      (.then #(:server-counter %))
      (.then #(swap! !client-state assoc :server/counter %))
      (.catch #(js/console.error "Failed to fetch server counter:" %))))

(defn ^:export sync-to-server! []
  (let [client-counter (:client/counter @!client-state)]
    (-> (js/fetch "/api/sync"
                  #js {:method "POST"
                       :headers #js {"Content-Type" "application/json"}
                       :body (str client-counter)})
        (.then #(.json %))
        (.then #(js->clj % :keywordize-keys true))
        (.then #(swap! !client-state assoc :server/counter (:server-counter %)))
        (.catch #(js/console.error "Failed to sync to server:" %)))))

(defn ^:export increment-counter! []
  (swap! !client-state update :client/counter inc))

(defn app-html [{:client/keys [counter] :as state}]
  (let [client-counter counter
        server-counter (get state :server/counter "Loading...")]
    (str "<div style='text-align: center; padding: 2rem; font-family: Arial, sans-serif;'>"
         "<h1>Acme Full-Stack Counter App</h1>"
         "<div style='margin: 2rem; display: flex; justify-content: space-around;'>"
         "<div style='padding: 1rem; border: 2px solid #4CAF50; border-radius: 8px; min-width: 200px;'>"
         "<h3>Client Counter</h3>"
         "<h2>" client-counter "</h2>"
         "<button onclick='acme.frontend.app.increment_counter_BANG_()' "
         "style='padding: 0.5rem 1rem; font-size: 1rem; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 0.5rem;'>"
         "Increment"
         "</button>"
         "</div>"
         "<div style='padding: 1rem; border: 2px solid #2196F3; border-radius: 8px; min-width: 200px;'>"
         "<h3>Server Counter</h3>"
         "<h2>" server-counter "</h2>"
         "<button onclick='acme.frontend.app.sync_to_server_BANG_()' "
         "style='padding: 0.5rem 1rem; font-size: 1rem; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 0.5rem;'>"
         "Sync to Server"
         "</button>"
         "<button onclick='acme.frontend.app.fetch_server_counter_BANG_()' "
         "style='padding: 0.5rem 1rem; font-size: 1rem; background: #FF9800; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 0.5rem;'>"
         "Refresh"
         "</button>"
         "</div>"
         "</div>"
         "</div>")))

(defn ^:dev/after-load update-dom! []
  (-> js/document
      (.getElementById "root")
      (.-innerHTML)
      (set! (app-html @!client-state))))

(defn ^:export init! []
  (println "Hello World")
  (dataspex/inspect "!client-state" !client-state)
  (add-watch !client-state :dom-update
             (fn [_k _r _o _n] (update-dom!)))
  (update-dom!)
  (fetch-server-counter!))