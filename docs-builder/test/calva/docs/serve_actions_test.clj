(ns calva.docs.serve-actions-test
  (:require [calva.docs.serve-actions :as actions]
            [clojure.test :refer [deftest is testing]]))

(def ^:private serving
  {:serve/port 8000
   :serve/server :server
   :serve/docs-dir "/repo/docs"
   :serve/src-dir "/repo/docs-builder/src"
   :serve/clients #{:browser}
   :serve/pending-paths #{}
   :build/root ".."
   :build/out-dir "../.tmp/site"
   :build/live-reload? true})

(def ^:private build-options
  {:build/root ".." :build/out-dir "../.tmp/site" :build/live-reload? true})

(deftest start
  (let [options (dissoc serving :serve/server :serve/clients :serve/pending-paths)
        {:uf/keys [db fxs]} (actions/handle-action {} [:serve/ax.start options])]
    (is (= true (:serve/building? db)))
    (is (= [[:serve/fx.track-code "/repo/docs-builder/src"]
            [:serve/fx.start-server {:serve/port 8000 :build/out-dir "../.tmp/site"}]
            [:serve/fx.watch ["/repo/docs" "/repo/docs-builder/src"]]
            [:serve/fx.build build-options false]]
           fxs)))
  (testing "a second start only reports"
    (is (= {:uf/fxs [[:serve/fx.log "Already serving on port 8000"]]}
           (actions/handle-action serving [:serve/ax.start {}])))))

(deftest paths-changed
  (testing "a page change builds without reloading code"
    (is (= [[:serve/fx.build build-options false]]
           (:uf/fxs (actions/handle-action serving [:serve/ax.paths-changed ["/repo/docs/site/api.md"]])))))
  (testing "a builder source change reloads code, then builds"
    (is (= [[:serve/fx.build build-options true]]
           (:uf/fxs (actions/handle-action serving [:serve/ax.paths-changed ["/repo/docs-builder/src/calva/docs/shell.clj"]])))))
  (testing "changes outside the docs and the builder source are ignored"
    (is (nil? (actions/handle-action serving [:serve/ax.paths-changed ["/repo/docs-builder/src/.#shell.clj~" "/repo/src/calva.ts"]]))))
  (testing "changes during a build wait for it"
    (is (= {:uf/db (assoc serving :serve/building? true :serve/pending-paths #{"/repo/docs/site/api.md"})}
           (actions/handle-action (assoc serving :serve/building? true)
                                  [:serve/ax.paths-changed ["/repo/docs/site/api.md"]])))))

(deftest build-finished
  (testing "a build reloads the browsers"
    (is (= [[:serve/fx.log "Built 69 files in 50 ms"]
            [:serve/fx.notify #{:browser}]]
           (:uf/fxs (actions/handle-action (assoc serving :serve/building? true)
                                           [:serve/ax.build-finished {:build/file-count 69 :build/ms 50}])))))
  (testing "a failed build leaves the browsers on the old site"
    (is (= [[:serve/fx.log "Build failed: boom"]]
           (:uf/fxs (actions/handle-action (assoc serving :serve/building? true)
                                           [:serve/ax.build-finished {:build/error "boom"}])))))
  (testing "changes that came in during the build start the next one"
    (let [{:uf/keys [db dxs]} (actions/handle-action (assoc serving
                                                            :serve/building? true
                                                            :serve/pending-paths #{"/repo/docs/site/api.md"})
                                                     [:serve/ax.build-finished {:build/file-count 69 :build/ms 50}])]
      (is (= false (:serve/building? db)))
      (is (= #{} (:serve/pending-paths db)))
      (is (= [[:serve/ax.paths-changed #{"/repo/docs/site/api.md"}]] dxs)))))

(deftest clients
  (is (= #{:browser :other}
         (-> (actions/handle-action serving [:serve/ax.client-opened :other]) :uf/db :serve/clients)))
  (is (= #{}
         (-> (actions/handle-action serving [:serve/ax.client-closed :browser]) :uf/db :serve/clients))))

(deftest code-reload
  (testing "unloading the serve namespace stops its watcher"
    (is (= {:uf/db (dissoc serving :serve/watcher)
            :uf/fxs [[:serve/fx.stop nil :watcher]]}
           (actions/handle-action (assoc serving :serve/watcher :watcher) [:serve/ax.unloading]))))
  (testing "the reloaded serve namespace starts a new watcher"
    (is (= {:uf/fxs [[:serve/fx.watch ["/repo/docs" "/repo/docs-builder/src"]]]}
           (actions/handle-action serving [:serve/ax.reloaded]))))
  (testing "a reload in place keeps the running watcher"
    (is (nil? (actions/handle-action (assoc serving :serve/watcher :watcher) [:serve/ax.reloaded]))))
  (testing "a stopped serve stays stopped"
    (is (nil? (actions/handle-action {} [:serve/ax.reloaded])))))

(deftest stop
  (is (= {:uf/db {} :uf/fxs [[:serve/fx.stop :server nil]]}
         (actions/handle-action serving [:serve/ax.stop]))))
