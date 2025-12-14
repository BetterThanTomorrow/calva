(ns acme.frontend.views)

(def ^:private button-style
  {:padding "0.5rem 1rem"
   :font-size "1rem"
   :color :white
   :border :none
   :border-radius "4px"
   :cursor :pointer
   :margin "0.5rem"})

(def ^:private container-style
  {:text-align :center
   :font-family "Arial, sans-serif"})

(def ^:private counters-container-style
  {:margin "1rem"
   :display :flex
   :gap "1rem"
   :flex-wrap :wrap
   :justify-content "space-around"})

(def ^:private counter-card-style
  {:padding "1rem"
   :border-radius "8px"
   :width "200px"})

(defn app [{:app/keys [client-counter] :as state}]
  (let [server-counter (get state :app/last-known-server-counter "Loading...")]
    [:div {:style container-style}
     [:h3 "Acme Full-Stack Counter App"]
     [:div {:style counters-container-style}
      [:div {:style (assoc counter-card-style :border "2px solid #4CAF50")}
       [:h4 "Client Counter"]
       [:h2 client-counter]
       [:button {:style (assoc button-style :background "#4CAF50")
                 :on {:click [:client/increment]}}
        "Increment"]]
      [:div {:style (assoc counter-card-style :border "2px solid #2196F3")}
       [:h4 "Server Counter"]
       [:h2 server-counter]
       [:button {:style (assoc button-style :background "#2196F3")
                 :on {:click [:server/sync]}}
        "Sync to Server"]
       [:button {:style (assoc button-style :background "#FF9800")
                 :on {:click [:server/fetch]}}
        "Refresh"]]]]))