(ns calva.docs.serve-actions
  "Decisions for the docs serve loop. An action takes the serve state and returns `:uf/db`, `:uf/fxs` and `:uf/dxs`."
  (:require [calva.docs.lint :as lint]
            [clojure.string :as string]))

(defn- code-path? [{:serve/keys [src-dir]} path]
  (and (string/starts-with? path (str src-dir "/"))
       (string/ends-with? path ".clj")))

(defn- content-path? [{:serve/keys [docs-dir]} path]
  (string/starts-with? path (str docs-dir "/")))

(defn- start-build [state]
  {:uf/db (assoc state :serve/building? true)
   :uf/fxs [[:serve/fx.build (select-keys state [:build/root :build/out-dir :build/live-reload?])]]})

(defn- build-report [{:build/keys [error file-count ms problems]}]
  (if error
    (str "Build failed: " error)
    (string/join "\n  " (cons (str "Built " file-count " files in " ms " ms")
                              (map lint/problem-report problems)))))

(defn- start
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

(defn- stop
  [{:serve/keys [server watcher]} _]
  {:uf/db {}
   :uf/fxs [[:serve/fx.stop server watcher]]})

(defn- reloaded
  [{:serve/keys [server watcher docs-dir src-dir] :as state} _]
  (when server
    (update (start-build (dissoc state :serve/watcher))
            :uf/fxs
            #(into [[:serve/fx.stop nil watcher]
                    [:serve/fx.watch [docs-dir src-dir]]]
                   %))))

(defn- paths-changed
  [{:serve/keys [building?] :as state} [_ paths]]
  (let [paths (filter #(or (content-path? state %) (code-path? state %)) paths)]
    (cond
      (empty? paths) nil
      building? {:uf/db (update state :serve/pending-paths into paths)}
      (some #(code-path? state %) paths) {:uf/db (assoc state :serve/building? true)
                                          :uf/fxs [[:serve/fx.reload-code]]}
      :else (start-build state))))

(defn- build-finished
  [{:serve/keys [pending-paths clients] :as state} [_ {:build/keys [error] :as result}]]
  {:uf/db (assoc state :serve/building? false :serve/pending-paths #{})
   :uf/fxs (cond-> [[:serve/fx.log (build-report result)]]
             (not error) (conj [:serve/fx.notify clients]))
   :uf/dxs (when (seq pending-paths)
             [[:serve/ax.paths-changed pending-paths]])})

(defn handle-action
  "Returns the next state, effects and follow-up actions for `action` in `state`."
  [state [kind & args :as action]]
  (case kind
    :serve/ax.start (start state action)
    :serve/ax.stop (stop state action)
    :serve/ax.reloaded (reloaded state action)
    :serve/ax.paths-changed (paths-changed state action)
    :serve/ax.build-finished (build-finished state action)
    :serve/ax.client-opened {:uf/db (update state :serve/clients conj (first args))}
    :serve/ax.client-closed {:uf/db (update state :serve/clients disj (first args))}
    :db/ax.assoc {:uf/db (apply assoc state args)}
    (throw (ex-info "Unhandled serve action" {:uf/action action}))))
