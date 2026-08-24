(ns fiddles.output-destinations
  (:require [calva.repl.webview.core :as output-view]
            [calva.repl.webview.greeting :as greeting]
            [calva.util :as util]))

(comment
  (do
    (def vsc @util/vscode)
    (def api (-> vsc .-extensions (.getExtension "betterthantomorrow.calva") .-exports))
    (def output-mod (js/require (str (.-extensionPath @util/vscode-context)
                                     "/out/results-output/output"))))

  (greeting/greeting-html {:view-kind :output-view
                           :logo-href "https://example.test/logo.svg"
                           :destinations "{\"evalResults\": \"terminal\"}"
                           :effective-items [{:key "nrepl" :value "1.0 (Calva defaults)"}]
                           :latest-items [{:key "nrepl" :value "1.1"}]})

  (greeting/html-for-view :output-view "https://example.test/logo.svg")

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

