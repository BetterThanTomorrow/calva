(ns calva.docs.serve-actions
  "Decisions for the docs serve loop. An action takes the serve state and returns `:uf/db`, `:uf/fxs` and `:uf/dxs`."
  (:require [clojure.string :as string]))

(defmulti handle-action
  "Returns the next state, effects and follow-up actions for `action` in `state`."
  (fn [_state [kind]] kind))

(defn- code-path? [{:serve/keys [src-dir]} path]
  (and (string/starts-with? path (str src-dir "/"))
       (string/ends-with? path ".clj")))

(defn- content-path? [{:serve/keys [docs-dir]} path]
  (string/starts-with? path (str docs-dir "/")))

(defn- start-build [state]
  {:uf/db (assoc state :serve/building? true)
   :uf/fxs [[:serve/fx.build (select-keys state [:build/root :build/out-dir :build/live-reload?])]]})

(defn- build-report [{:build/keys [error file-count ms]}]
  (if error
    (str "Build failed: " error)
    (str "Built " file-count " files in " ms " ms")))

(defmethod handle-action :serve/ax.start
  [{:serve/keys [server port]} [_ {:serve/keys [docs-dir src-dir] :as options}]]
  (if server
    {:uf/fxs [[:serve/fx.log (str "Already serving on port " port)]]}
    (let [state (assoc options :serve/clients #{} :serve/pending-paths #{})]
      (update (start-build state)
              :uf/fxs
              #(into [[:serve/fx.track-code src-dir]
                      [:serve/fx.start-server (select-keys state [:serve/port :build/out-dir])]
                      [:serve/fx.watch [docs-dir src-dir]]]
                     %)))))

(defmethod handle-action :serve/ax.stop
  [{:serve/keys [server watcher]} _]
  {:uf/db {}
   :uf/fxs [[:serve/fx.stop server watcher]]})

(defmethod handle-action :serve/ax.reloaded
  [{:serve/keys [server watcher docs-dir src-dir] :as state} _]
  (when server
    (update (start-build (dissoc state :serve/watcher))
            :uf/fxs
            #(into [[:serve/fx.stop nil watcher]
                    [:serve/fx.watch [docs-dir src-dir]]]
                   %))))

(defmethod handle-action :serve/ax.paths-changed
  [{:serve/keys [building?] :as state} [_ paths]]
  (let [paths (filter #(or (content-path? state %) (code-path? state %)) paths)]
    (cond
      (empty? paths) nil
      building? {:uf/db (update state :serve/pending-paths into paths)}
      (some #(code-path? state %) paths) {:uf/db (assoc state :serve/building? true)
                                          :uf/fxs [[:serve/fx.reload-code]]}
      :else (start-build state))))

(defmethod handle-action :serve/ax.build-finished
  [{:serve/keys [pending-paths clients] :as state} [_ {:build/keys [error] :as result}]]
  {:uf/db (assoc state :serve/building? false :serve/pending-paths #{})
   :uf/fxs (cond-> [[:serve/fx.log (build-report result)]]
             (not error) (conj [:serve/fx.notify clients]))
   :uf/dxs (when (seq pending-paths)
             [[:serve/ax.paths-changed pending-paths]])})

(defmethod handle-action :serve/ax.client-opened
  [state [_ channel]]
  {:uf/db (update state :serve/clients conj channel)})

(defmethod handle-action :serve/ax.client-closed
  [state [_ channel]]
  {:uf/db (update state :serve/clients disj channel)})

(defmethod handle-action :db/ax.assoc
  [state [_ k v]]
  {:uf/db (assoc state k v)})

(defmethod handle-action :default
  [_state action]
  (throw (ex-info "Unhandled serve action" {:uf/action action})))
