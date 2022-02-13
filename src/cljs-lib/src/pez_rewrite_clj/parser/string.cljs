(ns pez-rewrite-clj.parser.string
  (:require [pez-rewrite-clj.node :as node]
            [pez-rewrite-clj.reader :as r]
            [goog.string :as gstring]
            [clojure.string :as string]))

(defn- flush-into
  "Flush buffer and add string to the given vector."
  [lines buf]
  (let [s (.toString buf)]
    (.set buf "")
    (conj lines s)))

(defn- read-string-data
  [^not-native reader]
  (r/ignore reader)
  (let [buf (gstring/StringBuffer.)]
    (loop [escape? false
           lines []]
      (if-let [c (r/read-char reader)]
        (cond (and (not escape?) (identical? c \"))
              (flush-into lines buf)

              (identical? c \newline)
              (recur escape? (flush-into lines buf))

              :else
              (do
                (.append buf c)
                (recur (and (not escape?) (identical? c \\)) lines)))
        (r/throw-reader reader "Unexpected EOF while reading string.")))))

(defn parse-string
  [^not-native reader]
  (node/string-node (read-string-data reader)))

(defn parse-regex
  [^not-native reader]
  (let [lines (read-string-data reader)
        regex (string/join "\n" lines)]
    (node/token-node (re-pattern regex) (str "#\"" regex "\""))))
