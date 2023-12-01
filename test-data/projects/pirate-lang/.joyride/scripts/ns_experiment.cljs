(ns ns-experiment
  (:require ["ext://betterthantomorrow.calva$v0" :as calva]))

(calva/repl.evaluateCode "clj" (str '(do (println "Hello printed") "Hello a joyride eval")))

#_(calva/repl.evaluateCode "clj" (pr-str (list 'println "Hello printed")) {} #js {:ns "user"})