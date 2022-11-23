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
