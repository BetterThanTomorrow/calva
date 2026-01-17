(ns calva-lab
  (:require [joyride.core :as joy]
            [promesa.core :as p]))

(defn -main []
  ; Calva needs to have provided its nrepl client on globalThis
  (-> (p/let [session (.-session js/nClient)
              info (.info session "clojure.core", "map")
              doc (.-doc info)]
        doc)
      (p/catch (fn [e]
                 (js/console.error "Sadness" e)))))

(when (= (joy/invoked-script) joy/*file*)
  (-main))

(comment
  (require '["vscode" :as vscode])
  (def calva-ext (vscode/extensions.getExtension "betterthantomorrow.calva"))
  (def calva-api (.-exports calva-ext))
  (def v1-api (.-v1 calva-api))
  (.listSessions (.-repl v1-api))
  :rcf)

