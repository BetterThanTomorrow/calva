(ns calva.state)

(defonce ^:private state (atom {}))

(defn set-state-value! [key value]
  (swap! state assoc key value))

(defn get-state-value [key]
  (get @state key))

(defn get-state []
  @state)