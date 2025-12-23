(ns acme.db)

#?(:cljs (defonce !state (atom {:app/counter 0}))
   :clj (defonce !state (atom {:server/counter 0})))

(comment
  @!state

  ; .cljc -> cljs
  (swap! !state assoc :app/hello :world)
  (swap! !state update :app/counter inc)

  ; .cljc -> clj
  (swap! !state assoc :server/hello :world)
  (swap! !state update :server/counter inc)
  :rcf)
