(ns main2.core2
  (:require [reagent.core :as r]
            [reagent.dom :as rdom]))

(defonce app-state (r/atom {:text "Hello"}))

(defn hello-world [x]
  [:div
   [:h1 (:text @app-state) " " x "! 2"]
   [:p "shadow-w-backend2"]
   [:h3 "Edit this and watch it change!"]])

(defn ^:dev/after-load start []
  (js/console.log "start")
  (rdom/render [hello-world "world"]
               (. js/document (getElementById "app"))))

(defn ^:export init []
  (js/console.log "init")
  (start))

(defn ^:dev/before-load stop []
  (js/console.log "stop"))

(comment
  (js/alert)
  :rcf)

