(ns calva.greet
  (:require ["/calva/state.js" :as state]))

(defn activationGreetings [chan]
  (.appendLine chan "Calva activated. Happy Clojure(script) coding! ❤️")
  (.appendLine chan "Please file any feature requests or bug reports here: https://github.com/BetterThanTomorrow/calva/issues")
  (.appendLine chan "I will also respond to any @pez mentions in the #editors channel of the Clojurians Slack: https://clojurians.slack.com/messages/editors/")
  (.appendLine chan "")
  (.appendLine chan "NOTE: Files are no longer automatically evaluated when opened. You will need to issue the evaluate file command at will instead.")
  (.appendLine chan "NOTE: The evaluate file command does not seem to work in shadow-cljs clojurescript repls. A workaround, that someetimes suffices, is to select all contents of the file and evaluate it.")
  (when-not (.-lint (state/config))
    (.appendLine chan "")
    (.appendLine chan "NOTE: Autolinting is disabled. You need to enable \"calva.lintOnSave\" in your editor settings to use it. But first install Joker: https://github.com/candid82/joker"))
  (.appendLine chan (clojure.string/join (repeat 3 "-"))))