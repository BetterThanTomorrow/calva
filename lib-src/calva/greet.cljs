(ns calva.greet
  (:require [clojure.string :as string]))


(defn activationGreetings [^js chan lint?]
  (.appendLine chan "Happy Clojure(script) coding! ❤️")
  (.appendLine chan "Please file any feature requests or bug reports here: https://github.com/BetterThanTomorrow/calva/issues")
  (.appendLine chan "I will also respond to any @pez mentions in the #editors channel of the Clojurians Slack: https://clojurians.slack.com/messages/editors/")
  (.appendLine chan "")
  (.appendLine chan "NOTE: Files are no longer automatically evaluated when opened. You will need to issue the evaluate file command instead.")
  (.appendLine chan "NOTE: The evaluate file command does not seem to work in shadow-cljs clojurescript repls. A workaround, that sometimes suffices, is to select all contents of the file and evaluate it.")
  (when-not lint?
    (.appendLine chan "")
    (.appendLine chan "NOTE: Autolinting is disabled. You need to enable \"calva.lintOnSave\" in your editor settings to use it. But first install Joker: https://github.com/candid82/joker"))
  (.appendLine chan (string/join (repeat 3 "-"))))
