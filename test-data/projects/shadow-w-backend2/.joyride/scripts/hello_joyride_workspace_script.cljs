(ns hello-joyride-workspace-script
  (:require ["vscode" :as vscode]
            [joyride.core :as joyride]
            [promesa.core :as p]))

;; This is a sample Joyride Workspace script
;; See https://github.com/BetterThanTomorrow/joyride/tree/master/examples
;; for more examples.

(comment
  (sort ["🥚" "🐔"])
  (+ 1 2 39)
  (println "Hello World")
  )

;; You probably also want to install the Calva VS Code Extension.
;; New to Calva and/or Clojure? Use the Calva command:
;;   *Fire up the Getting Started REPL*
;; It will guide you through the basics.

(defn my-main []
  (p/let [answer (vscode/window.showInformationMessage "Hello World from your sample Joyride Workspace script. Which came first?" "🐔" "🥚")
          review (case answer
                   "🐔" (str '(sort ["🥚" "🐔"]) " agrees, but where did it hatch from?")
                   "🥚" "That's just like your opinion. Who laid it?"
                   "You chickened out!")]
    (println review)))

;; (joyride/invoked-script) will return
;; * the absolute path to the file of this script when
;;   the script is run via the `joyride.runWorkspaceScript`
;;   command.
;; * `nil` if this file is loaded in the REPL
;; That's why you can load it without `my-main` getting
;; called, but it will get called when you run the script.

(when (joyride/invoked-script)
  (my-main))