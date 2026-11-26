(ns calva.repl.input.stdin
  "Answers the reads from stdin of evaluations from files in the stdin input of an Output view's REPL Input:
   reveals the view, and waits there for the line."
  (:require
   [calva.repl.input.evaluate :as evaluate]
   [calva.repl.input.evaluations :as evaluations]
   [calva.repl.input.host :as host]
   [calva.repl.webview.core :as webview]
   [calva.util :as util]))

(defn- stop-waiting!
  [view-id evaluation-id]
  (swap! evaluate/!running dissoc evaluation-id)
  (evaluate/update-evaluations! view-id evaluations/finished evaluation-id))

(defn- wait!
  "Shows that the evaluation `evaluation-id` waits for a line in the stdin input of the REPL Input `view-id`,
   which `send-line!` gives to `resolve`."
  [view-id evaluation-id ^js evaluation resolve]
  (swap! evaluate/!running assoc evaluation-id {:evaluation evaluation
                                                :send-line (fn [line]
                                                             (stop-waiting! view-id evaluation-id)
                                                             (resolve line))})
  (evaluate/update-evaluations! view-id evaluations/started evaluation-id)
  (evaluate/update-evaluations! view-id evaluations/reading-stdin evaluation-id true))

(defn- reveal+
  "Reveals the Output view `view-id` with the focus in it."
  [view-id]
  (case view-id
    "output-sidebar" (.. ^js @util/vscode -commands (executeCommand "calva.output-sidebar.focus"))
    "output-view" (js/Promise.resolve (webview/show-repl-output-webview-panel false))))

(defn show-view!
  "Reveals the Output view `view-id` with the focus in its stdin input."
  [view-id]
  (-> (reveal+ view-id)
      (.then #(host/post-to-view! view-id host/focus-message))))

(defn ^:export read-line+
  "Returns a promise of the line that the stdin input of the REPL Input `view-id` sends to `evaluation`, an
   evaluation from a file that reads stdin. The waiting ends with the line, or when the evaluation ends."
  [^js evaluation view-id]
  (js/Promise.
   (fn [resolve _]
     (let [evaluation-id (evaluate/next-evaluation-id!)]
       (wait! view-id evaluation-id evaluation resolve)
       (some-> evaluation .-value (.catch (constantly nil)) (.then #(stop-waiting! view-id evaluation-id)))
       (show-view! view-id)))))
