(ns main.core
  (:require [reagent.core :as r]
            [reagent.dom :as rdom]
            [clojure.string :as string]))

(defonce app-state (r/atom {:text "Hello world!"}))

(defn hello-world []
  [:div
   [:h1 (:text @app-state)]
   [:h3 "Edit this and watch it change!"]])

(defn ^:dev/after-load start []
  (js/console.log "start")
  (rdom/render [hello-world]
               (. js/document (getElementById "app"))))

(defn ^:export init []
  (js/console.log "init")
  (start))

(defn ^:dev/before-load stop []
  (println (string/join " " [1 2 3]))
  (js/console.log "stop"))
