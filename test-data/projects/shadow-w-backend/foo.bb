(ns foo
  (:require
   [babashka.fs :as fs]
   [babashka.process :as process]))

(System/getProperty "java.class.path")