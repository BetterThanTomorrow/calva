(ns workspace-activate
  (:require [joyride.core :as joyride]
            [test-project]))

(when (= (joyride/invoked-script) joyride/*file*)
  (test-project/start!))

"ok"
