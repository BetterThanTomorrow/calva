(ns calva.greet
  (:require [clojure.string :as string]))


(defn ^:export activationGreetings [^js chan lint?]
  (.appendLine chan "Happy Clojure(script) coding! ❤️")
  (.appendLine chan "Please file any feature requests or bug reports here: https://github.com/BetterThanTomorrow/calva/issues")
  (.appendLine chan "I will also respond to any @pez mentions in the #calva-dev channel of the Clojurians Slack: https://clojurians.slack.com/messages/calva-dev/")
  (.appendLine chan "")
  (when-not lint?
    (.appendLine chan "")
    (.appendLine chan "NOTE: Autolinting is disabled. You need to enable \"calva.lintOnSave\" in your editor settings to use it. But first install Joker: https://github.com/candid82/joker"))
  (.appendLine chan (string/join (repeat 3 "-"))))
