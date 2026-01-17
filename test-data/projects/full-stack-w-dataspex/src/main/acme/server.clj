(ns acme.server
  (:require [acme.db :as db]
            [ring.adapter.jetty :as jetty]
            [ring.middleware.file :as ring-file]
            [ring.middleware.file-info :as ring-file-info]
            [clojure.string :as string]))

(comment
  (System/getProperty "java.version")
  :rcf)

(defn api-handler [req]
  (let [uri (:uri req)
        method (:request-method req)]
    (cond
      (and (= method :get) (= uri "/api/counter"))
      {:status 200
       :headers {"content-type" "application/json"
                 "access-control-allow-origin" "*"}
       :body (str "{\"server-counter\":" (:server/counter @db/!state) "}")}

      (and (= method :post) (= uri "/api/set-counter"))
      (let [body (slurp (:body req))
            client-counter (try
                             (-> body (string/replace #"[^0-9]" "") parse-long)
                             (catch Exception _ 0))]
        (swap! db/!state assoc :server/counter client-counter)
        {:status 200
         :headers {"content-type" "application/json"
                   "access-control-allow-origin" "*"}
         :body (str "{\"server-counter\":" (:server/counter @db/!state) "}")})

      :else
      {:status 404
       :headers {"content-type" "text/plain"}
       :body "Not found"})))

(defn my-handler [_req]
  {:status 200
   :headers {"content-type" "text/plain"}
   :body "Hello World!"})

(defn app-handler [req]
  (if (.startsWith (:uri req) "/api/")
    (api-handler req)
    (my-handler req)))

(def handler
  (-> app-handler
      (ring-file/wrap-file "public")
      (ring-file-info/wrap-file-info)))

(defn -main [& _args]
  (jetty/run-jetty handler {:port 3000}))
