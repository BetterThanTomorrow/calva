(ns calva.trail
  "A few lines that follow Calva's activation and its Output views, each with the time since Calva's code
   loaded. They go to the console and to the Calva Log output channel."
  (:require
   [calva.util :as util]))

(goog-define ^boolean enabled? true)

(defonce ^:private loaded-at (js/performance.now))

(defonce ^:private !channel (atom nil))

(defn- ^js channel
  "Returns the Calva Log output channel, created the first time it's asked for once Calva has the VS Code API."
  []
  (or @!channel
      (when-let [^js vscode @util/vscode]
        (let [created (.. vscode -window (createOutputChannel "Calva Log" #js {:log true}))]
          (some-> ^js @util/vscode-context .-subscriptions (.push created))
          (reset! !channel created)))))

(defn ^:export log!
  "Logs `message` after the milliseconds since Calva's code loaded, to the console after Calva's name, and to
   the Calva Log output channel. Logs nothing when `enabled?` is false, as in the unit tests."
  [message]
  (when enabled?
    (let [elapsed (str "+" (js/Math.round (- (js/performance.now) loaded-at)) "ms")]
      (util/log-to-console :info (str "[Calva " elapsed "] " message))
      (some-> (channel) (.info (str elapsed " " message))))))
