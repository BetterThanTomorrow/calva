(ns pez-rewrite-clj.parser
  (:require [pez-rewrite-clj.parser.core :as p]
            [pez-rewrite-clj.node :as node]
            [pez-rewrite-clj.reader :as r]))

;; ## Parser Core

(defn parse
  "Parse next form from the given reader."
  [^not-native reader]
  (p/parse-next reader))

(defn parse-all
  "Parse all forms from the given reader."
  [^not-native reader]
  (let [nodes (->> (repeatedly #(parse reader))
                   (take-while identity)
                   (doall))]
    (with-meta
      (node/forms-node nodes)
      (meta (first nodes)))))

;; ## Specialized Parsers

(defn parse-string
  "Parse first form in the given string."
  [s]
  (parse (r/indexing-push-back-reader s)))

(defn parse-string-all
  "Parse all forms in the given string."
  [s]
  (parse-all (r/indexing-push-back-reader s)))


