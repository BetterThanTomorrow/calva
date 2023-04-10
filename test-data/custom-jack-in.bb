#!/usr/bin/env bb

(require '[clojure.string :as str])

(defn parse-args [args]
  (loop [args args
         parsed {}]
    (if (empty? args)
      parsed
      (let [[flag value & rest-args] args]
        (case flag
          "--aliases" (recur rest-args (assoc parsed :aliases value))
          "--cider-nrepl-version" (recur rest-args (assoc parsed :cider-nrepl-version value))
          (do (println "Unknown parameter:" flag) (System/exit 1)))))))

(defn process-args [args]
  (let [aliases (str/split (:aliases args) #",")
        cider-nrepl-version (:cider-nrepl-version args)]
    (println "Aliases:")
    (doseq [alias aliases]
      (println alias))
    (println "CIDER nREPL version:" cider-nrepl-version)))

(def parsed-args (parse-args *command-line-args*))

(when (= *file* (System/getProperty "babashka.file"))
  (process-args parsed-args))