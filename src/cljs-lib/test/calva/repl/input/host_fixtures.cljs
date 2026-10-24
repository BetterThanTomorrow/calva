(ns calva.repl.input.host-fixtures
  "A host with a fake adapter and fake views, for testing `calva.repl.input.host`."
  (:require
   [calva.repl.input.host :as input-host]
   [cljs.reader :as reader]
   [clojure.string :as string]))

(defn fake-adapter [{:keys [contexts restored session-keys evaluations]}]
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
                                  (swap! evaluations conj {:options options :resolve resolve}))))})

(defn fake-view [posted]
  #js {:webview #js {:postMessage (fn [s] (swap! posted conj (reader/read-string s)))}})

(defn with-fresh-host [f]
  (let [host {:contexts (atom [])
              :restored (atom true)
              :posted (atom [])
              :session-keys (atom ["clj" "cljs"])
              :evaluations (atom [])}]
    (reset! input-host/!state input-host/initial-state)
    (reset! input-host/!adapter (fake-adapter host))
    (reset! input-host/!views {})
    (reset! input-host/!running {})
    (f host)))

(def !view (atom nil))

(defn post! [m]
  (input-host/handle-message! @!view (clj->js m :keyword-fn #(subs (str %) 1))))

(defn with-view [{:keys [posted]} f]
  (reset! !view (fake-view posted))
  (f))

(defn posted-named [posted command-name]
  (filterv #(= command-name (:command/name %)) @posted))

(defn last-context-line [posted]
  (select-keys (:repl-input/context-line (last (posted-named posted "repl-input-context")))
               [:repl-input.context/ns :repl-input.context/session :repl-input.context/locked?]))

(defn mount-focused! [id text]
  (post! {:command "repl-input-mounted" :repl-input/id id :version 0 :text "" :selections [[0 0]]})
  (post! {:command "repl-input-focused" :repl-input/id id})
  (post! {:command "repl-input-changed" :repl-input/id id :version 1 :text text :selections [[(count text) (count text)]]}))
