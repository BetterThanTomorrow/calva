(ns calva-lab
  (:require [joyride.core :as joy]
            [promesa.core :as p]))

(defn -main []
  (-> (p/let [session (.-session js/nClient)
              info (.info session "clojure.core", "map")
              doc (.-doc info)]
        doc)
      (p/catch (fn [e]
                 (js/console.error "Sadness" e)))))

(when (= (joy/invoked-script) joy/*file*)
  (-main))
