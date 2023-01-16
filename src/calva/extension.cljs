(ns calva.extension
  (:require ["vscode" :as vscode :refer [window]]
            ["/foo" :as foo]))

(comment
  (.. foo (hello))
  :rcf)

(defonce current-context (atom nil))
(defonce disposables (atom []))

(defn add-disposable! [disposable]
  (swap! disposables conj disposable))

(defn dispose-all!
  [disposables]
  (run! (fn [^js disposable]
          (.. disposable (dispose)))
        disposables))

(defn say-hello []
  (.. window (showInformationMessage "Hello world!")))

(defn register-command!
  [command-name command-function]
  (let [disposable (.. vscode -commands (registerCommand
                                         command-name
                                         command-function))]
    (add-disposable! disposable)))

(defn activate
  [^js context]
  (reset! current-context context)
  (register-command! "calva.sayHello" say-hello)
  (prn "Calva activated"))

(defn deactivate
  []
  (dispose-all! @disposables)
  (prn "Calva deactivated"))

(defn before-load-async [done]
  (deactivate)
  (done))

(defn after-load []
  (activate @current-context)
  (prn "Calva reloaded"))

