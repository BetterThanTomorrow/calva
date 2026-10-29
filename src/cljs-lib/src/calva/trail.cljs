(ns calva.trail
  "A few console lines that follow Calva's activation and its Output views, each with the time since
   Calva's code loaded."
  (:require
   [calva.util :as util]))

(goog-define ^boolean enabled? true)

(defonce ^:private loaded-at (js/performance.now))

(defn ^:export log!
  "Logs `message` to the console after Calva's name and the milliseconds since Calva's code loaded. Logs nothing
   when `enabled?` is false, as in the unit tests."
  [message]
  (when enabled?
    (util/log-to-console :info (str "[Calva +" (js/Math.round (- (js/performance.now) loaded-at)) "ms] " message))))
