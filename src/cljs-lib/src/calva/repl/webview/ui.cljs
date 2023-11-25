(ns calva.repl.webview.ui
  (:require [reagent.dom :as rdom]))

(defn repl-output []
  [:div "hello world"])

(defn render-ui []
  (rdom/render [repl-output] (js/document.getElementById "output")))
