(ns calva.docs.serve-actions
  "Decisions for the docs serve loop. An action takes the serve state and returns `:uf/db`, `:uf/fxs` and `:uf/dxs`."
  (:require [calva.docs.lint :as lint]
            [clojure.string :as string]))

(defn- slashed [path]
  (string/replace path "\\" "/"))

(defn- under?
  "True when `path` is inside `dir`. Windows paths use backslashes."
  [dir path]
  (string/starts-with? (slashed path) (str (slashed dir) "/")))

(defn- code-path? [{:serve/keys [src-dir]} path]
  (and (under? src-dir path)
       (string/ends-with? path ".clj")))

(defn- content-path? [{:serve/keys [docs-dir]} path]
  (under? docs-dir path))

(defn- start-build [{:serve/keys [run] :as state}]
  {:uf/db (assoc state :serve/building? true)
   :uf/fxs [[:serve/fx.build run (select-keys state [:build/root :build/out-dir :build/live-reload?])]]})

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
  "Swaps in a new watcher and builds, when the code reload is from the current run."
  [{:serve/keys [run watcher docs-dir src-dir] :as state} [_ reload-run]]
  (when (= run reload-run)
    (update (start-build (dissoc state :serve/watcher))
            :uf/fxs
            #(into [[:serve/fx.stop nil watcher]
                    [:serve/fx.watch [docs-dir src-dir]]]
                   %))))

(defn- paths-changed
  [{:serve/keys [run building?] :as state} [_ paths]]
  (let [paths (filter #(or (content-path? state %) (code-path? state %)) paths)]
    (cond
      (empty? paths) nil
      building? {:uf/db (update state :serve/pending-paths into paths)}
      (some #(code-path? state %) paths) {:uf/db (assoc state :serve/building? true)
                                          :uf/fxs [[:serve/fx.reload-code run]]}
      :else (start-build state))))

(defn- build-finished
  "Reports the build and reloads the browsers, when the build is from the current run."
  [{:serve/keys [run pending-paths clients] :as state} [_ build-run {:build/keys [error] :as result}]]
  (when (= run build-run)
    {:uf/db (assoc state :serve/building? false :serve/pending-paths #{})
     :uf/fxs (cond-> [[:serve/fx.log (build-report result)]]
               (not error) (conj [:serve/fx.notify clients]))
     :uf/dxs (when (seq pending-paths)
               [[:serve/ax.paths-changed pending-paths]])}))

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
