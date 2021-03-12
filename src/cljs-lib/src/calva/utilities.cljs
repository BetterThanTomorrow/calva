(ns calva.utilities
  (:require ["process" :as process]))

(def windows-os? (= (. process -platform) "win32"))