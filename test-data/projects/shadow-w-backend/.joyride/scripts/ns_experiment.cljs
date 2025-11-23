(ns ns-experiment
  (:require ["ext://betterthantomorrow.calva$v0" :as calva-v0]
            ["ext://betterthantomorrow.calva$v1" :as calva]
            ["vscode" :as vscode]))

(-> (calva-v0/repl.evaluateCode "clj" (str '(do (println "Hello printed") "Hello a joyride eval")))
    (.then (fn [result]
             (println (.-output result)))))

(calva-v0/repl.evaluateCode "clj" (pr-str (list 'println "Hello printed")) {} #js {:ns "user"})

(calva-v0/repl.evaluateCode js/undefined (str '(do (println "Hello printed") "Hello a joyride eval")))


(println calva-v0)
(println calva)

(-> (calva/repl.evaluateCode "clj" (str '(do (println "Hello printed from calva-v1") "Hello a joyride eval from calva-v1")))
    (.then (fn [result]
             (println (.-output result))
             result)))

(-> (calva/repl.evaluateCode "clj"
                             (str '(do (println "Hello printed from calva-v1 in pirate ns") "Hello a joyride eval from calva-v1"))
                             "pez.pirate-lang")
    (.then (fn [result]
             (println (.-output result))
             result)))

{:ns (calva/document.getNamespace vscode/window.activeTextEditor.document)
 :ns-current (calva/document.getNamespace)
 :ns-and-form (calva/document.getNamespaceAndNsForm)}

(-> (calva/repl.evaluateCode "clj"
                             (second (calva/document.getNamespaceAndNsForm)))
    (.then (fn [result]
             (println (.-result result))
             result)))

(-> (calva/repl.evaluateCode "clj"
                             "*ns*"
                             (calva/document.getNamespace))
    (.then (fn [result]
             (println (.-result result))
             result)))