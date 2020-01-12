(ns calva.fmt.util
  (:require [clojure.string]
            ["paredit.js" :as paredit]
            [calva.js-utils :refer [cljify]]
            [calva.parse :refer [parse-clj-edn]]))


(defn log
  "logs out the object `o` excluding any keywords in `exclude-kws`"
  [o & exlude-kws]
  (println (pr-str (if (map? o) (apply dissoc o exlude-kws) o)))
  o)


(defn escape-regexp
  "Escapes regexp characters in `s`"
  [s]
  (clojure.string/replace s #"([.*+?^${}()|\[\]\\])" "\\$1"))


(defn current-line
  "Finds the text of the current line in `text` from cursor position `index`"
  [text index]
  (let [head (subs text 0 index)
        tail (subs text index)]
    (str (second (re-find #"\n?(.*)$" head))
         (second (re-find #"^(.*)\n?" tail)))))


(defn re-pos-first
  "Find position of first match of `re` in `s`"
  [re s]
  (if-let [m (.match s re)]
    (.-index m)
    -1))


(defn split-into-lines
  [s]
  (clojure.string/split s #"\r?\n" -1))


(defn enclosing? [text]
  (let [ast (cljify (paredit/parse text))
        children (:children ast)]
    (and (= 1 (count children))
         (= "list" (:type (first children))))))

(def fs (js/require "fs"))

(defn slurp [filename] ((aget fs "readFileSync") filename "utf8"))

(defn read-edn-file [filename]
  (try
    (parse-clj-edn (slurp filename))
    (catch js/Error _e {})))

(comment
  (enclosing? "[][]")
  (enclosing? "([][])")
  (enclosing? "([)")
  (enclosing? "[\"[\"]")
  (enclosing? "(\"[\")")
  (enclosing? "\"foo\"")
  (enclosing? "\"([.*+?^${}()\n|\\[\\]\\])\"")
  (enclosing? "\"([.*+?^${}()\\n|\\\\[\\\\]\\\\])\""))
