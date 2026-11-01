(ns calva.repl.webview.styles-reload
  "Renders the Output views' styles into the page after each code reload, in development."
  (:require [calva.repl.webview.styles :as styles]))

(defn ^:dev/after-load render-styles!
  []
  (when-let [style (js/document.getElementById "calva-output-styles")]
    (set! (.-textContent style) (styles/css))))
