(ns main
  (:require ["node:os" :as os]))

(defn greeting
  []
  (str "Hello from " (os/platform)))

(println (greeting))
