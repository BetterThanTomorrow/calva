(ns bar
  (:require [foo]))

; We've had reports about evaluated symbols being unloaded
; The following could be a repro, even if it isn't when I (@PEZ) try it.

; 0. Start REPL
; 1. Load this file
; 2. Uncomment the following line
;(foo/profile)
; 3. Evaluate the above top level form

; Expected result: "Profile called" is returned
; Result when issue is hitting: Error: no such var foo/profile