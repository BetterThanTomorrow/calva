(ns fiddles.output-destinations
  (:require [calva.util :as util]
            [calva.repl.webview.core :as output-view]))

(comment
  (do
    (def vsc @util/vscode)
    (def api (-> vsc .-extensions (.getExtension "betterthantomorrow.calva") .-exports))
    (def output-mod (js/require (str (.-extensionPath @util/vscode-context)
                                     "/out/results-output/output"))))

  (js->clj (.get (.getConfiguration (.-workspace vsc) "calva") "outputDestinations")
           :keywordize-keys true)

  (mapv (fn [t]
          {:name (.-name t)
           :exit-code (some-> t .-exitStatus .-code)
           :exit-reason (some-> t .-exitStatus .-reason)})
        (.. vsc -window -terminals))

  {:title (some-> @output-view/output-view-webview-panel .-title)
   :visible (some-> @output-view/output-view-webview-panel .-visible)}

  (js->clj (.listSessions (.-repl (.-v1 api))) :keywordize-keys true)

  (-> (.evaluate (.-repl (.-v1 api))
                 "{:probe :fiddle :t (System/currentTimeMillis)}"
                 #js {:ns "user"
                      :sessionKey "clj"
                      :who "fiddle"
                      :description "fiddle pirate-lang ping"})
      (.then (fn [r]
               (def pirate-result (js->clj r :keywordize-keys true))))
      (.catch (fn [e]
                (def pirate-result {:error (.-message e)}))))

  pirate-result

  (.showOutputTerminal output-mod true)
  (output-view/show-repl-output-webview-panel true)
  (.appendClojureOther output-mod "fiddle ping")

  :rcf)

