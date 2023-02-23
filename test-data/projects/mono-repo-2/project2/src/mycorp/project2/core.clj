(ns mycorp.project2.core
  (:require [mycorp.lib1.core]))

; make sure that you can jump to the definition of mycorp.lib1.core/myfunk
(defn myfunk []
  (mycorp.lib1.core/myfunk)
  (prn "Hi from project2"))


(comment
  (myfunk))