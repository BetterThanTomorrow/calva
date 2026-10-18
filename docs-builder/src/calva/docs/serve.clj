(ns calva.docs.serve
  "The docs dev server. Serves the built site, rebuilds on change, and reloads the browsers."
  (:require [calva.docs.build :as build]
            [calva.docs.serve-actions :as actions]
            [clj-reload.core :as reload]
            [clojure.java.io :as io]
            [nextjournal.beholder :as beholder]
            [org.httpkit.server :as http]
            [ring.middleware.content-type :as content-type]
            [ring.middleware.file :as file]))

(defonce ^:private !state (atom {}))

(defmulti ^:private perform-effect! (fn [[kind]] kind))

(defn dispatch!
  "Runs `action` through the serve loop."
  [action]
  (locking !state
    (let [{:uf/keys [db fxs dxs]} (actions/handle-action @!state action)]
      (when db
        (reset! !state db))
      (run! perform-effect! fxs)
      (run! dispatch! dxs))))

(defn- reload-socket [request]
  (http/as-channel request
                   {:on-open #(dispatch! [:serve/ax.client-opened %])
                    :on-close (fn [channel _status]
                                (dispatch! [:serve/ax.client-closed channel]))}))

(defn- handler [site-dir]
  (let [site (-> (fn [_] {:status 404 :body "Not found"})
                 (file/wrap-file site-dir)
                 content-type/wrap-content-type)]
    (fn [{:keys [uri] :as request}]
      (if (= "/__reload" uri)
        (reload-socket request)
        (site request)))))

(defn- error-message [e]
  (str (ex-message e) (some->> (ex-cause e) ex-message (str ": "))))

(defmethod perform-effect! :serve/fx.log [[_ message]]
  (println message))

(defmethod perform-effect! :serve/fx.track-code [[_ src-dir]]
  (reload/init {:dirs [src-dir] :output :quieter}))

(defmethod perform-effect! :serve/fx.start-server [[_ {:serve/keys [port] :build/keys [out-dir]}]]
  (.mkdirs (io/file out-dir))
  (dispatch! [:db/ax.assoc :serve/server
              (http/run-server (handler out-dir) {:port port :legacy-return-value? false})])
  (println (str "Serving the docs on http://localhost:" port)))

(defmethod perform-effect! :serve/fx.watch [[_ dirs]]
  (dispatch! [:db/ax.assoc :serve/watcher
              (apply beholder/watch
                     #(dispatch! [:serve/ax.paths-changed [(str (:path %))]])
                     dirs)]))

(defmethod perform-effect! :serve/fx.build [[_ options]]
  (future
    (dispatch! [:serve/ax.build-finished
                (try
                  (build/build! options)
                  (catch Throwable e
                    {:build/error (error-message e)}))])))

(defmethod perform-effect! :serve/fx.reload-code [_]
  (future
    (try
      (reload/reload {:only #"calva\.docs\.serve"})
      (catch Throwable e
        (dispatch! [:serve/ax.build-finished {:build/error (error-message e)}])))))

(defmethod perform-effect! :serve/fx.notify [[_ clients]]
  (doseq [channel clients]
    (http/send! channel "reload")))

(defmethod perform-effect! :serve/fx.stop [[_ server watcher]]
  (some-> server http/server-stop!)
  (some-> watcher beholder/stop))

(defn- canonical-path [& parts]
  (.getCanonicalPath ^java.io.File (apply io/file parts)))

(defn start!
  "Builds the docs, serves them on `port`, and rebuilds when the docs or the builder change."
  [& {:serve/keys [port] :or {port 8000}}]
  (dispatch! [:serve/ax.start {:serve/port port
                               :serve/docs-dir (canonical-path ".." "docs")
                               :serve/src-dir (canonical-path "src")
                               :build/root ".."
                               :build/out-dir "../.tmp/site"
                               :build/live-reload? true}]))

(defn stop!
  "Stops the server and the file watcher."
  []
  (dispatch! [:serve/ax.stop]))

(defn after-ns-reload
  "clj-reload calls this after it loads this namespace. The serve then builds, and swaps
  in a file watcher that calls this namespace, since the old one calls the replaced code."
  []
  (dispatch! [:serve/ax.reloaded]))

(comment
  (start!)
  (stop!)
  :rcf)
