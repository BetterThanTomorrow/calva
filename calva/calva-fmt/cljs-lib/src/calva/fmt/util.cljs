(ns calva.fmt.util
  (:require [clojure.string]
            ["paredit.js" :as paredit]
            [calva.js-utils :refer [cljify jsify]]))


(defn log
  "logs out the object `o` excluding any keywords in `exclude-kws`"
  [o & exlude-kws]
  (println (pr-str (if (map? o) (apply dissoc o exlude-kws) o)))
  o)


(defn escape-regexp
  "Escapes regexp characters in `s`"
  [s]
  (clojure.string/replace s #"([.*+?^${}()|\[\]\\])" "\\$1"))


(defn ^:export current-line
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


(defn ^:export enclosing? [text]
  (let [ast (cljify (paredit/parse text))
        children (:children ast)]
    (and (= 1 (count children))
         (= "list" (:type (first children))))))

(comment
  (enclosing? "[][]")
  (enclosing? "([][])")
  (enclosing? "([)")
  (enclosing? "[\"[\"]")
  (enclosing? "(\"[\")")
  (enclosing? "\"foo\"")
  (enclosing? "\"([.*+?^${}()\n|\\[\\]\\])\"")
  (enclosing? "\"([.*+?^${}()\\n|\\\\[\\\\]\\\\])\""))
