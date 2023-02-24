(ns mycorp.lib1.core
  (:require [clojure.string]))

; make sure that you can jump to clojure.string/capitalize
(defn myfunk
  []
  (prn (clojure.string/capitalize "hi from lib1")))

; this shouldn't be linted as unused-pulic-var due to `$repo/.clj-kondo/config.edn`
(def an-unused-var 123)


; this should be linted as unused-private-var
(defn- an-unused-private-var [] 123)