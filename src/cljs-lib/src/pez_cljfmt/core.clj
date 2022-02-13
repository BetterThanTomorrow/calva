(ns pez-cljfmt.core
  (:require [clojure.java.io :as io]))

(def read-resource* (comp read-string slurp io/resource))
(defmacro read-resource [path] `'~(read-resource* path))