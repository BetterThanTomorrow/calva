(ns fiddles.footing
  (:require [calva.util :as util]))

(comment
  (do
    (def vsc @util/vscode)
    (def api (-> vsc .-extensions (.getExtension "betterthantomorrow.calva") .-exports))
    (def v1 (.-v1 api)))

  {:node-version (.-version js/process)
   :cwd (js/process.cwd)
   :extension-id (some-> @util/vscode-context .-extension .-id)
   :extension-path (some-> @util/vscode-context .-extensionPath)
   :extension-mode (some-> @util/vscode-context .-extensionMode)}

  {:workspace-folders (mapv (fn [f]
                              {:name (.-name f)
                               :path (.-fsPath (.-uri f))})
                            (.-workspaceFolders (.-workspace vsc)))
   :active-file (some-> vsc .-window .-activeTextEditor .-document .-fileName)}

  {:api-keys (js-keys api)
   :v1-keys (js-keys v1)
   :repl-keys (js-keys (.-repl v1))
   :current-session-key (.currentSessionKey (.-repl v1))}

  (js->clj (.listSessions (.-repl v1)) :keywordize-keys true)

  (-> (.evaluate (.-repl v1)
                 (str "{:ns (str *ns*)"
                      " :clojure-version (clojure-version)"
                      " :java-version (System/getProperty \"java.version\")"
                      " :cwd (System/getProperty \"user.dir\")}")
                 #js {:ns "user"
                      :sessionKey "clj"
                      :who "fiddle"
                      :description "inner project identity"})
      (.then (fn [r]
               (def inner-footing (js->clj r :keywordize-keys true))))
      (.catch (fn [e]
                (def inner-footing {:error (.-message e)}))))

  inner-footing

  (-> (.evaluate (.-repl v1)
                 "(require 'pez.pirate-lang) (pez.pirate-lang/to-pirate-talk \"Ahoy from the outer REPL\" pez.pirate-lang/english-o)"
                 #js {:ns "user"
                      :sessionKey "clj"
                      :who "fiddle"
                      :description "pirate-talk ping"})
      (.then (fn [r]
               (def pirate-talk (js->clj r :keywordize-keys true))))
      (.catch (fn [e]
                (def pirate-talk {:error (.-message e)}))))

  pirate-talk
  ;; last seen :result => "Ahohoyoy fofroromom tothohe outoteror RoREPoPLoL"

  :rcf)
