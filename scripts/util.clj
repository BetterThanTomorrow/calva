(ns util
  (:require [babashka.process :as p]))

(defn throw-if-error [{:keys [exit out err] :as result}]
  (if-not (= exit 0)
    (throw (Exception. (if (empty? out) err out)))
    result))

(defn sh [dry-run? & args]
  (if dry-run?
    (do (println "Dry run:" (apply pr-str args))
        {:exit 0})
    (do
      (apply println args)
      (flush)
      (throw-if-error (apply p/sh args)))))

(defn shell [dry-run? & args]
  (if dry-run?
    (do (println "Dry run:" (apply pr-str args))
        {:exit 0})
    (do
      (apply println args)
      (flush)
      (apply p/shell args))))

(defn random-slug [n]
  (apply str (repeatedly n #(rand-nth "abcdefghijklmnopqrstuvwxyz"))))
