(ns calva.repl.input.printed-code
  "The extension's side of the printed code's editor in the Output views: the record of its text and
   selections in each view, the keys it leaves to VS Code, its brackets and guides at its cursors, and
   Paredit's moves and selections in it."
  (:require
   [calva.repl.input.command-keys :as command-keys]
   [calva.repl.input.focus :as focus]
   [calva.repl.input.highlighting :as highlighting]
   [calva.repl.input.host :as host]
   [calva.repl.input.records :as records]))

(defonce ^{:doc "The document of the printed code in each view, `{:text :doc}` by view id."}
  !documents (atom {}))

(defn- document
  "Returns a document with the text and the selections of `record`, made once for the text in its view,
   since printed code can be long and its text stays."
  [{:repl-input/keys [id text selections selections-stack] :as record}]
  (let [{cached-text :text doc :doc} (get @!documents id)]
    (if (= text cached-text)
      (.withSelections ^js @host/!adapter doc (clj->js selections) (clj->js (or selections-stack [])))
      (let [doc (host/document record)]
        (swap! !documents assoc id {:text text :doc doc})
        doc))))

(defn- command-keys-for
  [{:repl-input/keys [keybindings] :as state} record]
  (command-keys/command-keys keybindings
                             (command-keys/context state record focus/printed-code-focused-context)))

(defn- brackets
  "The brackets of `doc`, with the active guides and the brackets matched at its cursors, when its `text` is
   no longer than the printed code that gets colored."
  [{:repl-input/keys [settings]} text doc]
  (when (<= (count text) highlighting/max-printed-length)
    (host/document-brackets settings doc)))

(defn- derive!
  "Derives the cursor contexts, the command keys and the brackets of the printed code in the view `id`, sets
   the cursor contexts while it has focus, and posts the command keys and the brackets to it when they
   changed."
  [id]
  (when-let [{:repl-input/keys [text version] :printed-code/keys [editor] :as record} (get-in @host/!state [:printed-code/records id])]
    (let [state @host/!state
          doc (document record)
          with-contexts (assoc record :repl-input/cursor-contexts (js->clj (.cursorContexts ^js @host/!adapter doc)))
          derived (assoc with-contexts
                         :repl-input/command-keys (command-keys-for state with-contexts)
                         :repl-input/brackets (brackets state text doc))]
      (swap! host/!state assoc-in [:printed-code/records id] derived)
      (when (= id (:printed-code/focused @host/!state))
        (host/apply-cursor-contexts!))
      (when (not= (:repl-input/command-keys record) (:repl-input/command-keys derived))
        (host/post-to-view! id {:command/name "printed-code-command-keys"
                                :repl-input/command-keys (:repl-input/command-keys derived)}))
      (when (not= (:repl-input/brackets record) (:repl-input/brackets derived))
        (host/post-to-view! id {:command/name "printed-code-brackets"
                                :editor editor
                                :version version
                                :brackets (:repl-input/brackets derived)})))))

(defn- take-record!
  [f {:repl-input/keys [id] :as msg}]
  (let [[before after] (swap-vals! host/!state update :printed-code/records f msg)]
    (when (not= (get-in before [:printed-code/records id]) (get-in after [:printed-code/records id]))
      (derive! id))))

(defn- focused!
  "Takes the focus of the printed code in the view `id` in `webview-host`, with its text and selections,
   reading Calva's keybindings first when no REPL Input has."
  [^js webview-host {:repl-input/keys [id] :as msg}]
  (swap! host/!views assoc id webview-host)
  (take-record! records/take-focus msg)
  (host/update-focus! [:printed-code-focus id])
  (when (empty? (:repl-input/keybindings @host/!state))
    (host/load-keybindings!)))

(defn forget!
  "Forgets the printed code in the view `id`, as when its editor goes, or its page loads anew."
  [id]
  (swap! host/!state update :printed-code/records records/remove-record id)
  (swap! !documents dissoc id)
  (host/update-focus! [:printed-code-unmount id]))

(defn handle-message!
  "Takes a message that the printed code's editor in `webview-host` posted. Returns nil for other messages."
  [^js webview-host command {:repl-input/keys [id] :as msg}]
  (case command
    "printed-code-focused" (focused! webview-host msg)
    "printed-code-changed" (take-record! records/take-selections msg)
    "printed-code-blurred" (host/update-focus! [:printed-code-blur id])
    "printed-code-unmounted" (forget! id)
    nil))

(defn- command-target
  "Returns the view of the printed code that Calva's commands reach in `state`: the focused one, or else the
   last focused place, as while the command palette has the focus."
  [{:printed-code/keys [focused last-focused]}]
  (or focused last-focused))

(defn ^:export focused?
  "True while Calva's commands reach printed code: while it has focus, or is the last focused place."
  []
  (some? (command-target @host/!state)))

(defn- command-target!
  "Returns the view of the printed code that Calva's commands reach, and gives the focus back to it when it
   is the last focused place."
  []
  (let [{:printed-code/keys [focused] :as state} @host/!state
        target (command-target state)]
    (when (and target (not focused))
      (host/reveal-view! target {:command/name "printed-code-focus"}))
    target))

(defn- moved!
  "Posts the selections that a command made in `doc` from `record` of the printed code in the view `id`,
   when they moved. A command that changed the text has its change dropped, and the document made anew
   next time."
  [id {:repl-input/keys [version text selections selections-stack] :printed-code/keys [editor]} doc]
  (let [after (host/document-state doc)]
    (cond
      (not= text (:text after))
      (swap! !documents dissoc id)

      (not= [selections (or selections-stack [])] [(:selections after) (or (:selections-stack after) [])])
      (let [[old new] (swap-vals! host/!state update :printed-code/records records/take-edit id version after)]
        (when (not= old new)
          (host/post-to-view! id {:command/name "printed-code-selections"
                                  :editor editor
                                  :version version
                                  :selections (:selections after)})
          (derive! id))))))

(defn ^:export select-focused!
  "Runs `f` on a document with the text and selections of the printed code that Calva's commands reach, and
   posts the selections `f` made to it. Returns a promise of when that is done. When `f` fails, the document
   is made anew next time."
  [f]
  (let [target (command-target!)]
    (if-let [record (get-in @host/!state [:printed-code/records target])]
      (let [doc (document record)]
        (-> (js/Promise.resolve)
            (.then (fn [_] (f doc)))
            (.then (fn [_] (moved! target record doc)))
            (.catch (fn [e]
                      (swap! !documents dissoc target)
                      (throw e)))))
      (js/Promise.resolve nil))))

(defn- settings-changed?
  [before after]
  (not= (select-keys before [:repl-input/settings :repl-input/keybindings :repl-input/connected?])
        (select-keys after [:repl-input/settings :repl-input/keybindings :repl-input/connected?])))

(defn init!
  "Derives the printed code's records anew when the settings, the keybindings or the connection change, and
   forgets a view's printed code when the view goes."
  []
  (add-watch host/!state ::settings
             (fn [_ _ before after]
               (when (settings-changed? before after)
                 (run! derive! (keys (:printed-code/records after))))))
  (add-watch host/!views ::views
             (fn [_ _ before after]
               (doseq [id (remove (set (keys after)) (keys before))]
                 (swap! host/!state update :printed-code/records records/remove-record id)
                 (swap! !documents dissoc id)))))
