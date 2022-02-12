(ns pez-rewrite-clj.parser.keyword
  (:require [pez-rewrite-clj.node :as node]
            [cljs.tools.reader.reader-types]
            [pez-rewrite-clj.reader :as r]))

(defn parse-keyword
  [^not-native reader]
  (r/read-char reader)
  (if-let [c (r/peek-char reader)]
    (if (identical? c \:)
      (node/keyword-node
        (r/read-keyword reader ":")
        true)
      (do
        (r/unread reader \:)
        (node/keyword-node (r/read-keyword reader ":"))))
    (r/throw-reader reader "unexpected EOF while reading keyword.")))
