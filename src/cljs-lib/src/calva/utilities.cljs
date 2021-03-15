(ns calva.utilities
  (:require ["process" :as process]
            [calva.state :as state]))

(def windows-os? (= (. process -platform) "win32"))

(defn connected? []
  (state/get-state-value "connected"))

(comment
  (connected?))