(ns calva.repl.webview.main
  (:require
   [calva.repl.webview.input.editor :as input-editor]
   [calva.repl.webview.tooltip :as tooltip]
   [calva.repl.webview.ui :as ui]))

(defn- init-repl-input!
  []
  (when-let [element (input-editor/mount-element)]
    (let [dataset (.-dataset element)]
      (ui/dispatch! [:repl-input/ax.init {:repl-input/id (.-replInputId dataset)
                                          :repl-input/enabled? (= "true" (.-replInputEnabled dataset))}]))))

(defn ^:export main []
  (.append js/document.body (tooltip/element))
  (ui/main)
  (ui/register-effect-handler! "repl-input" input-editor/exec-effect!)
  (init-repl-input!))
