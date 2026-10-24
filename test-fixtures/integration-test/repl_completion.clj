(ns repl-completion
  (:require [clojure.string :as string]))

(defn to-pirate-talk [s]
  (string/upper-case s))

(comment
  (string/upp "x")
  (only-in-r)
  (string/upper-case "x")
  (to-pirate-talk "y")
  :rcf)
