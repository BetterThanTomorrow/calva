(ns calva.pprint.printer
  (:require [zprint.core :refer [zprint-str]]
            [calva.js-utils :refer [jsify]]))


(defn pretty-print
  "Parses the string `s` as EDN and returns it pretty printed as a string.
   Accepts that s is an EDN form already, and skips the parsing, if so.
   Formats the result to fit the width `w`."
  ([s]
   (pretty-print s 0))
  ([s w]
   (let [result
         (try
           {:value
            (zprint-str s w {:parse-string? (string? s)})}
           (catch js/Error e
             {:value s
              :error (str "Plain printing, b/c pprint failed. (" e.message ")")}))]
     result)))

(defn pretty-print-js [& args]
  (jsify (apply pretty-print args)))
