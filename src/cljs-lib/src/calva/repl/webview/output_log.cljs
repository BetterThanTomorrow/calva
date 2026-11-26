(ns calva.repl.webview.output-log
  "The log of the output the extension posted the Output views, which a view's new page replays. Each entry
   is a message and the Output views it went to, by their Output Destination ids. The messages are kept
   without printed code's highlighting, which a page that replays them asks for in the colors it has then.")

(def kept-count
  "How many of the latest entries the log keeps."
  5000)

(def empty-log
  "A log without entries. Its last entry is kept apart from the others, so a view can be added to it
   without walking them."
  {:output-log/entries #queue []
   :output-log/last nil})

(defn- with-entry
  "Returns `log` with `entry` last, keeping the latest `kept-count` entries."
  [{:output-log/keys [entries last] :as log} entry]
  (let [entries (cond-> entries last (conj last))]
    (assoc log
           :output-log/entries (if (< (count entries) kept-count) entries (pop entries))
           :output-log/last entry)))

(defn with-message
  "Returns `log` with `message` posted to the Output view `view-id`. A message that is the same as the last
   entry's, which hasn't gone to the view yet, adds the view to that entry, as when the output goes to both
   views."
  [{:output-log/keys [last] :as log} view-id message]
  (let [message (dissoc message :output/highlighting)]
    (if (and (= message (:message last))
             (not (contains? (:views last) view-id)))
      (update-in log [:output-log/last :views] conj view-id)
      (with-entry log {:message message :views #{view-id}}))))

(defn- entries
  [{:output-log/keys [entries last]}]
  (cond-> (vec entries) last (conj last)))

(defn without-view
  "Returns `log` with the Output view `view-id` taken off every entry, and the entries no view has left
   dropped."
  [log view-id]
  (let [kept (into []
                   (comp (map #(update % :views disj view-id))
                         (filter (comp seq :views)))
                   (entries log))]
    (assoc empty-log
           :output-log/entries (into #queue [] (butlast kept))
           :output-log/last (peek kept))))

(defn view-messages
  "Returns the messages of `log` that went to the Output view `view-id`, oldest first."
  [log view-id]
  (into [] (comp (filter #(contains? (:views %) view-id)) (map :message)) (entries log)))

(defonce !log (atom empty-log))

(defn log!
  "Logs `message` as posted to the Output view `view-id`."
  [view-id message]
  (swap! !log with-message view-id message))

(defn clear!
  "Takes the Output view `view-id` off the log."
  [view-id]
  (swap! !log without-view view-id))

(defn messages
  "Returns the logged messages of the Output view `view-id`, oldest first."
  [view-id]
  (view-messages @!log view-id))
