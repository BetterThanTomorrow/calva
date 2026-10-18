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

(declare dispatch!)

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
  (str (or (ex-message e) (.getName (class e)))
       (some->> (ex-cause e) ex-message (str ": "))))

(defn- start-server! [[_ {:serve/keys [port] :build/keys [out-dir]}]]
  (.mkdirs (io/file out-dir))
  (dispatch! [:db/ax.assoc :serve/server
              (http/run-server (handler out-dir) {:port port :legacy-return-value? false})])
  (println (str "Serving the docs on http://localhost:" port)))

(defn- watch! [[_ dirs]]
  (dispatch! [:db/ax.assoc :serve/watcher
              (apply beholder/watch
                     #(dispatch! [:serve/ax.paths-changed [(str (:path %))]])
                     dirs)]))

(defn- build! [[_ run options]]
  (dispatch! [:db/ax.assoc :serve/build
              (future
                (dispatch! [:serve/ax.build-finished run
                            (try
                              (build/build! options)
                              (catch Throwable e
                                {:build/error (error-message e)}))]))]))

(defn- reload-code!
  "Reloads the changed builder code, then continues through the `dispatch!` that the reload
  may have replaced, since this code and its watcher are then the replaced code."
  [[_ run]]
  (future
    (try
      (reload/reload)
      ((requiring-resolve `dispatch!) [:serve/ax.reloaded run])
      (catch Throwable e
        (dispatch! [:serve/ax.build-finished run {:build/error (error-message e)}])))))

(defn- stop-serving! [[_ server watcher]]
  (some-> server http/server-stop!)
  (some-> watcher beholder/stop))

(defn- perform-effect! [[kind & args :as effect]]
  (case kind
    :serve/fx.log (println (first args))
    :serve/fx.track-code (reload/init {:dirs [(first args)] :output :quieter})
    :serve/fx.start-server (start-server! effect)
    :serve/fx.watch (watch! effect)
    :serve/fx.build (build! effect)
    :serve/fx.reload-code (reload-code! effect)
    :serve/fx.notify (doseq [channel (first args)] (http/send! channel "reload"))
    :serve/fx.stop (stop-serving! effect)
    (throw (ex-info "Unhandled serve effect" {:uf/effect effect}))))

(defn dispatch!
  "Runs `action` through the serve loop."
  [action]
  (locking !state
    (let [{:uf/keys [db fxs dxs]} (actions/handle-action @!state action)]
      (when db
        (reset! !state db))
      (run! perform-effect! fxs)
      (run! dispatch! dxs))))

(defn- canonical-path [& parts]
  (.getCanonicalPath ^java.io.File (apply io/file parts)))

(defn start!
  "Builds the docs, serves them on `port`, and rebuilds when the docs or the builder change."
  [& {:serve/keys [port] :or {port 8765}}]
  (dispatch! [:serve/ax.start {:serve/port port
                               :serve/run (random-uuid)
                               :serve/docs-dir (canonical-path ".." "docs")
                               :serve/src-dir (canonical-path "src")
                               :build/root ".."
                               :build/out-dir "../.tmp/site"
                               :build/live-reload? true}]))

(defn stop!
  "Stops the server and the file watcher, then waits for a build in progress, so that a
  new start doesn't build into the same directory at the same time."
  []
  (some-> (locking !state
            (let [{:serve/keys [build]} @!state]
              (dispatch! [:serve/ax.stop])
              build))
          deref))

(comment
  (start!)
  (stop!)
  :rcf)
