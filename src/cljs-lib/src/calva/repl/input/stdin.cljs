(ns calva.repl.input.stdin
  "Answers the reads from stdin of evaluations from files in the Output Sidebar's REPL Input: reveals the
   sidebar, turns its REPL Input on for the session when it is off, and waits there for the line."
  (:require
   [calva.repl.input.core :as core]
   [calva.repl.input.evaluate :as evaluate]
   [calva.repl.input.evaluations :as evaluations]
   [calva.repl.input.host :as host]
   [calva.repl.input.messages :as messages]
   [calva.util :as util]))

(def view-id "output-sidebar")

(defn- stop-waiting!
  [evaluation-id]
  (swap! evaluate/!running dissoc evaluation-id)
  (evaluate/update-evaluations! view-id evaluations/finished evaluation-id))

(defn- wait!
  "Shows that the evaluation `evaluation-id` waits for a line in the Output Sidebar's REPL Input, which
   `send-line!` gives to `resolve`."
  [evaluation-id ^js evaluation resolve]
  (swap! evaluate/!running assoc evaluation-id {:evaluation evaluation
                                                :send-line (fn [line]
                                                             (stop-waiting! evaluation-id)
                                                             (resolve line))})
  (evaluate/update-evaluations! view-id evaluations/started evaluation-id)
  (evaluate/update-evaluations! view-id evaluations/reading-stdin evaluation-id true))

(defn show-sidebar!
  "Reveals the Output Sidebar with the focus in its REPL Input, turning it on for the session when it is off."
  []
  (when-not (host/enabled? view-id)
    (core/toggle-output-sidebar!))
  (-> (.. ^js @util/vscode -commands (executeCommand "calva.output-sidebar.focus"))
      (.then #(host/post-to-view! view-id messages/focus-message))))

(defn ^:export read-line+
  "Returns a promise of the line that the Output Sidebar's REPL Input sends to `evaluation`, an evaluation
   from a file that reads stdin. The waiting ends with the line, or when the evaluation ends."
  [^js evaluation]
  (js/Promise.
   (fn [resolve _]
     (let [evaluation-id (evaluate/next-evaluation-id!)]
       (wait! evaluation-id evaluation resolve)
       (some-> evaluation .-value (.catch (constantly nil)) (.then #(stop-waiting! evaluation-id)))
       (show-sidebar!)))))
