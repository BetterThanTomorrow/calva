(ns hello)

(+ 1 1)

(require '["vscode" :as vscode])

(vscode/window.showInformationMessage "Hello", "OK")