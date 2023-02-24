(ns mycorp.project1.core
  (:require [mycorp.lib2.core]))

; make sure that you can jump to the definition of mycorp.lib2.core/myfunk
(defn myfunk []
  (mycorp.lib2.core/myfunk)
  (prn "Hi from project1"))

; make sure that you can run this after starting a deps.edn repl in mono-repo-2/project1 with the "Calva: start a project REPL..." command
; it should print:
; "Hi from lib1"
; "Hi from lib2"
; "Hi from project1"
(comment
  (myfunk))