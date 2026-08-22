(ns fiddles.output-heartbeat)

(defn ping
  "Writes a timestamp to *out* and returns it as the eval result."
  []
  (let [t (str (java.time.Instant/now))]
    (println "evalOutput" t)
    {:evalResults t}))

(defonce !pinger
  (atom {:future nil
         :n 0
         :started-at nil
         :last-t nil}))

(defn stop-pinger!
  []
  (when-let [f (:future @!pinger)]
    (future-cancel f))
  (swap! !pinger assoc :future nil)
  :stopped)

(defn start-pinger!
  "Prints evalOutput beat N <instant> every 60 seconds."
  []
  (stop-pinger!)
  (let [started (str (java.time.Instant/now))
        f (future
            (try
              (loop []
                (let [t (str (java.time.Instant/now))
                      n (:n (swap! !pinger update :n inc))]
                  (println "evalOutput beat" n t)
                  (swap! !pinger assoc :last-t t)
                  (Thread/sleep 60000)
                  (recur)))
              (catch InterruptedException _
                :stopped)))]
    (swap! !pinger assoc
           :future f
           :started-at started
           :n 0
           :last-t nil)
    {:started-at started}))

(comment
  (ping)
  (start-pinger!)
  @!pinger
  (stop-pinger!)
  :rcf)
