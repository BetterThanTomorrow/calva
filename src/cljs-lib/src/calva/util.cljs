(ns calva.util
  (:require [calva.state :as state]))

(defonce vscode (atom nil))
(defonce vscode-context (atom nil))

(def project-root-uri-key "connect.projectDirNew")

(defn get-first-workspace-folder-uri []
  (-> (.. ^js @vscode -workspace -workspaceFolders)
      first ;; Handle nil here?
      (.. -uri)))

(defn ^:export get-project-root-uri
  ([]
   (get-project-root-uri true))
  ([use-cache]
   (if use-cache
     (if-let [project-directory-uri (state/get-state-value project-root-uri-key)]
       project-directory-uri
       (get-first-workspace-folder-uri))
     (get-first-workspace-folder-uri))))

(defn ^:export initialize-cljs
  "This is meant to be called upon extension activation, and will store the vscode api reference and the context in atoms.

   This allows the cljs code to access the vscode API, without having to require it, which can cause testing issues.

   We cannot run unit tests on code that imports the vscode API, because it's only available at runtime.
   All cljs code is bundled into a single file and required by the TypeScript code, which means we cannot
   write unit tests for any TypeScript code that imports the cljs code, if any of the cljs code requires the VS Code API."
  [^js vsc ^js ctx]
  (reset! vscode vsc)
  (reset! vscode-context ctx))

(defn log-to-console
  "Log to the console. This is a simple interface to js/console.* functions.
   The first argument is the log level. Log levels accepted are :info, :error, and :warn.
   Arguments after the first are passed to the js/console.* function.
   This function exists to help with testing, since using with-redefs with a js/console.*
   function directly doesn't seem to work."
  [& args]
  (let [log-level (first args)
        log-fn (case log-level
                 :info js/console.info
                 :error js/console.error
                 :warn js/console.warn)]
    (apply log-fn (rest args))))
