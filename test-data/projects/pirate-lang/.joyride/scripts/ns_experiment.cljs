(ns ns-experiment
  (:require ["ext://betterthantomorrow.calva$v0" :as calva]))

(-> (calva/repl.evaluateCode "clj" (str '(do (println "Hello printed") "Hello a joyride eval")))
    (.then (fn [result]
             (println (.-output result)))))

(calva/repl.evaluateCode "clj" (pr-str (list 'println "Hello printed")) {} #js {:ns "user"})

(calva/repl.evaluateCode js/undefined (str '(do (println "Hello printed") "Hello a joyride eval")))