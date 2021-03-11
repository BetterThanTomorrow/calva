(ns calva.state)

(defonce ^:private state (atom {}))

(defn set-state-value! [key value]
  (swap! state assoc key value))

(defn remove-state-value! [key]
  (swap! state dissoc key))

(defn get-state-value [key]
  (get @state key))

(defn get-state []
  @state)

(comment
  (set-state-value! "hello" "world")
  (get-state)
  (remove-state-value! "hello"))