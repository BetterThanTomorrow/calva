(ns fiddles.cursor-host
  (:require [calva.util :as util]))

(comment
  (do
    (def vsc @util/vscode)
    (def ext-get (fn [id] (.getExtension (.-extensions vsc) id)))
    (def ext-row (fn [id]
                   (when-let [e (ext-get id)]
                     {:id (.-id e)
                      :active (.-isActive e)}))))

  {:app-name (.-appName (.-env vsc))
   :app-root (.-appRoot (.-env vsc))
   :has-cursor (exists? (.-cursor vsc))
   :has-lm (exists? (.-lm vsc))
   :has-chat (exists? (.-chat vsc))}

  (try
    {:cursor-keys (vec (js-keys (.-cursor vsc)))}
    (catch js/Error e
      {:cursor-gated? true
       :error (.-message e)}))

  {:mcp-keys (js-keys (.-mcp (.-cursor vsc)))
   :plugin-keys (js-keys (.-plugins (.-cursor vsc)))
   :register-server? (fn? (.-registerServer (.-mcp (.-cursor vsc))))}

  {:joyride (ext-row "betterthantomorrow.joyride")
   :backseat (ext-row "betterthantomorrow.calva-backseat-driver")
   :agent-exec (ext-row "anysphere.cursor-agent-exec")}

  (-> (.getCommands (.-commands vsc) true)
      (.then (fn [cmds]
               (def host-cmds
                 (->> (js->clj cmds)
                      (filter (fn [c]
                                (or (.startsWith c "cursor-agent-exec.")
                                    (.startsWith c "joyride.")
                                    (re-find #"composer\.(new|send|start|create)" c))))
                      sort
                      vec))))
      (.catch (fn [e]
                (def host-cmds {:error (.-message e)}))))

  host-cmds

  ;; spawn candidates, not invoked here:
  ;; composer.newAgentChat
  ;; composer.sendToAgent
  ;; composer.startComposerPrompt

  (-> (.selectChatModels (.-lm vsc) #js {})
      (.then (fn [models]
               (def host-models
                 (mapv (fn [m]
                         {:id (.-id m)
                          :vendor (.-vendor m)
                          :family (.-family m)
                          :name (.-name m)})
                       models))))
      (.catch (fn [e]
                (def host-models {:error (.-message e)}))))

  host-models

  :rcf)
