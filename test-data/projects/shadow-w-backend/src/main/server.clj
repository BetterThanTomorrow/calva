(ns main.server
  #_(:require [babashka.fs :as fs])
  (:gen-class))

(defn -main
  "I don't do a whole lot ... yet."
  [& _args]
  (println "Hello, World!"))

(comment
  (-main)
  (System/getProperty "user.dir")
  (rand-int 100)
  )