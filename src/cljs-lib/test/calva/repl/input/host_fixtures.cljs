(ns calva.repl.input.host-fixtures
  "A host with a fake adapter and fake views, for testing `calva.repl.input.host`."
  (:require
   [calva.repl.input.complete :as complete]
   [calva.repl.input.evaluate :as evaluate]
   [calva.repl.input.host :as input-host]
   [calva.repl.input.messages :as messages]
   [cljs.reader :as reader]
   [clojure.string :as string]))

(defn- pending-completion
  "Records a call with `args` to an adapter function that completes, and returns a promise that the
   test resolves."
  [completions source args]
  (js/Promise. (fn [resolve _]
                 (swap! completions conj (assoc args :source source :resolve resolve)))))

(defn fake-adapter [{:keys [contexts restored session-keys evaluations completions]}]
  #js {:setContext (fn [k v] (swap! contexts conj [k v]))
       :document (fn [text selections] #js {:text text :selections selections})
       :documentState (fn [^js doc] #js {:text (.-text doc) :selections (.-selections doc)})
       :cursorContexts (fn [^js doc] #js {"calva:cursorInComment" (string/starts-with? (.-text doc) ";")})
       :brackets (fn [^js doc ^js options] #js {:text (.-text doc) :colorCount (.-colorCount options)})
       :restoreEditorCursorContexts (fn [] @restored)
       :editorNamespace (fn [^js document _position] #js [(.-ns document) (str "(ns " (.-ns document) ")")])
       :routedSessionKey (fn [^js document] (if document (.-sessionKey document) "clj"))
       :sessionKeys (fn [] (clj->js @session-keys))
       :nsFromText (fn [code] (when-let [[form ns] (re-find #"^\(ns ([\w.]+)\)" code)] #js [ns form]))
       :evaluate (fn [options]
                   (js/Promise. (fn [resolve _]
                                  (swap! evaluations conj {:options options :resolve resolve}))))
       :replCompletions (fn [session-key ns ^js doc offset]
                          (pending-completion completions :repl {:session-key session-key :ns ns :text (.-text doc) :offset offset}))
       :lspCompletions (fn [uri text line character]
                         #js {:items (pending-completion completions :lsp {:uri uri :text text :line line :character character})
                              :cancel #(swap! completions conj {:source :cancel :text text})})
       :mergeCompletions (fn [lsp repl] (.concat lsp repl))
       :resolveReplCompletion (fn [session-key ns item]
                                (js/Promise.resolve #js {:detail (str ns " in " session-key) :documentation (str "REPL docs for " (.-label item))}))
       :resolveLspCompletion (fn [_uri item]
                               (js/Promise.resolve #js {:detail "lsp" :documentation #js {:kind "markdown" :value (str "LSP docs for " (.-label item))}}))})

(defn fake-view [posted]
  #js {:webview #js {:postMessage (fn [s] (swap! posted conj (reader/read-string s)))}})

(defn with-fresh-host [f]
  (let [host {:contexts (atom [])
              :restored (atom true)
              :posted (atom [])
              :session-keys (atom ["clj" "cljs"])
              :evaluations (atom [])
              :completions (atom [])}]
    (reset! input-host/!state input-host/initial-state)
    (reset! input-host/!adapter (fake-adapter host))
    (reset! input-host/!views {})
    (reset! evaluate/!running {})
    (reset! complete/!completions {})
    (f host)))

(def !view (atom nil))

(defn post! [m]
  (messages/handle-message! @!view (clj->js m :keyword-fn #(subs (str %) 1))))

(defn with-view [{:keys [posted]} f]
  (reset! !view (fake-view posted))
  (f))

(defn posted-named [posted command-name]
  (filterv #(= command-name (:command/name %)) @posted))

(defn last-context-line [posted]
  (select-keys (:repl-input/context-line (last (posted-named posted "repl-input-context")))
               [:repl-input.context/ns :repl-input.context/session-key :repl-input.context/locked?]))

(defn mount-focused! [id text]
  (post! {:command "repl-input-mounted" :repl-input/id id :version 0 :text "" :selections [[0 0]]})
  (post! {:command "repl-input-focused" :repl-input/id id})
  (post! {:command "repl-input-changed" :repl-input/id id :version 1 :text text :selections [[(count text) (count text)]]}))
