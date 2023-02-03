(ns test-runner
  (:require [clojure.string :as string]
            [cljs.test]
            [config :as config]
            [db :as db]
            [promesa.core :as p]))

(defn- write [& xs]
  (js/process.stdout.write (string/join " " xs)))

(defmethod cljs.test/report [:cljs.test/default :begin-test-var] [m]
  (write "===" (str (-> m :var meta :name) ": ")))

(defmethod cljs.test/report [:cljs.test/default :end-test-var] [m]
  (write " ===\n"))

(def old-pass (get-method cljs.test/report [:cljs.test/default :pass]))

(defmethod cljs.test/report [:cljs.test/default :pass] [m]
  (binding [*print-fn* write] (old-pass m))
  (write "✅")
  (swap! db/!state update :pass inc))

(def old-fail (get-method cljs.test/report [:cljs.test/default :fail]))

(defmethod cljs.test/report [:cljs.test/default :fail] [m]
  (binding [*print-fn* write] (old-fail m))
  (write "❌")
  (swap! db/!state update :fail inc))

(def old-error (get-method cljs.test/report [:cljs.test/default :fail]))

(defmethod cljs.test/report [:cljs.test/default :error] [m]
  (binding [*print-fn* write] (old-error m))
  (write "🚫")
  (swap! db/!state update :error inc))

(def old-end-run-tests (get-method cljs.test/report [:cljs.test/default :end-run-tests]))

(defmethod cljs.test/report [:cljs.test/default :end-run-tests] [m]
  (binding [*print-fn* write]
    (old-end-run-tests m)
    (let [{:keys [running pass fail error]} @db/!state
          passed-minimum-threshold 2
          fail-reason (cond
                        (< 0 (+ fail error)) "FAILURE: Some tests failed or errored"
                        (< pass passed-minimum-threshold) (str "FAILURE: Less than " passed-minimum-threshold " assertions passed")
                        :else nil)]
      (println "Runner: tests run, results:" (select-keys  @db/!state [:pass :fail :error]))
      (if fail-reason
        (p/reject! running fail-reason)
        (p/resolve! running true)))))

;; We rely on that the user_activate.cljs script is run before workspace_activate.cljs
(defn- run-when-ws-activated [tries]
  (if (:ws-activated? @db/!state)
    (do
      (println "Runner: Workspace activated, running tests...")
      (try
        (doseq [ns-sym (config/ns-symbols)]
          (require ns-sym)
          (cljs.test/run-tests ns-sym))
        (catch :default e
          (p/reject! (:running @db/!state) e))))
    (do
      (println "Runner: Workspace not activated yet, tries: " tries "- trying again in a jiffy")
      (js/setTimeout #(run-when-ws-activated (inc tries)) 10))))

(defn run-all-tests []
  (let [running (p/deferred)]
    (swap! db/!state assoc :running running)
    (run-when-ws-activated 1)
    running))

(comment
  (run-all-tests)
  :rcf)

