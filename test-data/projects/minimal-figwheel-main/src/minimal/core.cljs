;; first notify figwheel that this ns has callbacks defined in it
(ns ^:figwheel-hooks minimal.core)

(enable-console-print!)

(defn start []
  (println "Hello World")
  (-> js/document
      (.getElementById "app")
      (.-innerHTML)
      (set! "Acme App started.")))

(defn ^:export init []
  (println "Initializing...")
  (start))

(defn ^:after-load reload []
  (println "Reloading...")
  (start))
