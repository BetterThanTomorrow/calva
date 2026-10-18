(ns calva.docs.cli
  "Command line entry: `build` or `serve`."
  (:require [calva.docs.build :as build]
            [calva.docs.serve :as serve]))

(defn- parse-args [[command & flags]]
  (loop [[flag value & more] flags
         parsed {:cli/command command}]
    (case flag
      nil parsed
      "--port" (recur more (assoc parsed :serve/port (parse-long value)))
      "--out" (recur more (assoc parsed :build/out-dir value))
      "--production" (recur (cons value more) (assoc parsed :build/production? true))
      (throw (ex-info (str "Unknown option " flag) {:cli/flag flag})))))

(defn -main
  [& args]
  (let [{:cli/keys [command] :as options} (parse-args args)]
    (case command
      "build" (let [{:build/keys [file-count out-dir ms]}
                    (build/build! (merge {:build/root ".." :build/out-dir "../site"} options))]
                (println "Built" file-count "files into" out-dir "in" ms "ms"))
      "serve" (do (serve/start! options)
                  @(promise))
      (do (println "Usage: clojure -M:build [--out dir] [--production] | clojure -M:serve [--port n]")
          (System/exit 1)))))
