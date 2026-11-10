(ns calva.repl.webview.throttle
  "Throttled functions, for work the page doesn't need to do for every event.")

(defn throttle-fn
  "Returns a throttled version of the function, which will only be called at most once every `wait`
   milliseconds with the arguments passed in the latest call.

   If the throttled function is called again during the wait period, it will not execute until the wait period has
   passed, after which it will only be called once, no matter how many times it was called during the wait, and
   a new wait period starts. If the throttled function is called again after the wait period, it will execute
   immediately."
  [f wait]
  (let [timeout (atom nil)
        pending-args (atom nil)]
    (letfn [(start-wait! []
              (reset! timeout (js/setTimeout (fn []
                                               (reset! timeout nil)
                                               (when-let [args @pending-args]
                                                 (reset! pending-args nil)
                                                 (apply f args)
                                                 (start-wait!)))
                                             wait)))]
      (fn [& args]
        (if @timeout
          (reset! pending-args (vec args))
          (do (apply f args)
              (start-wait!)))))))
