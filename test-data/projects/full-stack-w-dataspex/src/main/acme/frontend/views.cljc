(ns acme.frontend.views)

(def ^:private button-style
  {:padding "0.5rem 1rem"
   :font-size "1rem"
   :color "white"
   :border "none"
   :border-radius "4px"
   :cursor "pointer"
   :margin "0.5rem"})

(defn app [{:client/keys [counter] :as state}]
  (let [server-counter (get state :server/counter "Loading...")]
    [:div {:style {:text-align "center"
                   :padding "2rem"
                   :font-family "Arial, sans-serif"}}
     [:h3 "Acme Full-Stack Counter App"]
     [:div {:style {:margin "2rem"
                    :display "flex"
                    :justify-content "space-around"}}
      [:div {:style {:padding "1rem"
                     :border "2px solid #4CAF50"
                     :border-radius "8px"
                     :min-width "200px"}}
       [:h4 "Client Counter"]
       [:h2 counter]
       [:button {:style (assoc button-style :background "#4CAF50")
                 :on {:click [:client/increment]}}
        "Increment"]]
      [:div {:style {:padding "1rem"
                     :border "2px solid #2196F3"
                     :border-radius "8px"
                     :min-width "200px"}}
       [:h4 "Server Counter"]
       [:h2 server-counter]
       [:button {:style (assoc button-style :background "#2196F3")
                 :on {:click [:server/sync]}}
        "Sync to Server"]
       [:button {:style (assoc button-style :background "#FF9800")
                 :on {:click [:server/fetch]}}
        "Refresh"]]]]))