(ns test-project
  "Starts and stops what the Calva test protocol needs in this window: four Calva
   REPL sessions of different kinds, one of them in the tic-tac-toe Flare. Every
   step looks at what is already running first, so `start!` can run again at any
   time without starting anything twice."
  (:require ["fs" :as fs]
            ["net" :as net]
            ["path" :as path]
            ["vscode" :as vscode]
            [joyride.flare :as flare]))

;; The sessions

(def server-repls
  "The REPLs that run as VS Code tasks. A task keeps running when the window
   reloads, so a reload costs a reconnect. Calva connects through the port file
   that the server writes in the project root."
  [{:task "clj nREPL"
    :connect-sequence {:name "Test project: clj"
                       :projectType "deps.edn"
                       :projectRootPath ["repls" "clj"]
                       :cljsType "none"
                       :nReplPortFile [".nrepl-port"]
                       :selectedPortBehaviour "connect"
                       :replSessionNames {:primary "clj"}
                       :replSessionFilePatterns {:primary {:always-claim ["*.clj" "deps.edn"]}}}}
   {:task "bb nREPL"
    :connect-sequence {:name "Test project: bb"
                       :projectType "babashka"
                       :projectRootPath ["repls" "bb"]
                       :cljsType "none"
                       :nReplPortFile [".nrepl-port"]
                       :selectedPortBehaviour "connect"
                       :replSessionNames {:primary "bb"}
                       :replSessionFilePatterns {:primary {:always-claim ["*.bb" "*.clj" "bb.edn"]}}}}])

(def joyride-sequence
  "Calva's Joyride jack-in starts the nREPL server of this window's Joyride and
   connects with Calva's built-in Joyride sequence, so only the project type and
   root of this one count. When the server runs already, Calva connects with all
   of it, through Joyride's port file. Both ways the session is `joyride`, with
   the Joyride project type's file patterns."
  {:name "Test project: joyride"
   :projectType "joyride"
   :projectRootPath ["."]
   :nReplPortFile [".joyride" ".nrepl-port"]
   :selectedPortBehaviour "connect"})

(def tic-tac-toe-port
  "Calva's WebSocket server for the tic-tac-toe page. The Joyride test project
   uses 13400, and both windows can be open at once."
  13401)

(def tic-tac-toe-sequence
  {:name "Test project: tic-tac-toe"
   :projectType "scittle"
   :projectRootPath ["projects" "scittle-replicant-tic-tac-toe"]
   :webSocketPort tic-tac-toe-port
   :replSessionNames {:primary "tic-tac-toe"}
   :replSessionFilePatterns {:primary {:always-claim ["resources/scittle/**/*.cljs"]}}})

(def tic-tac-toe-key :tic-tac-toe)

(def tic-tac-toe-dir "projects/scittle-replicant-tic-tac-toe/resources/scittle/")

(defn- primary-session [connect-sequence]
  (get-in connect-sequence [:replSessionNames :primary]))

(def session-keys
  "The Calva sessions this window's test protocol uses."
  (into #{"joyride" (primary-session tic-tac-toe-sequence)}
        (map (comp primary-session :connect-sequence) server-repls)))

;; Waiting

(defn- sleep+ [ms]
  (js/Promise. (fn [resolve] (js/setTimeout resolve ms))))

(defn ^:async wait-for!+
  "Polls `pred+` (a function returning a value or a promise) until it is truthy
   or `timeout-ms` has passed. Resolves to the last value."
  [pred+ timeout-ms]
  (loop [waited 0]
    (let [v (await (pred+))]
      (if (or v (>= waited timeout-ms))
        v
        (do (await (sleep+ 500))
            (recur (+ waited 500)))))))

(defn- with-timeout+
  "Resolves to what `promise` resolves to, or to `nil` after `ms`."
  [promise ms]
  (js/Promise.race #js [promise (.then (sleep+ ms) (constantly nil))]))

(defn- port-open?+ [port]
  (js/Promise.
   (fn [resolve]
     (let [socket (net/connect port "127.0.0.1")]
       (.on socket "connect" (fn []
                               (.end socket)
                               (resolve true)))
       (.on socket "error" (fn [_]
                             (resolve false)))))))

;; Calva

(defn ^:async calva-repl+ []
  (let [ext (vscode/extensions.getExtension "betterthantomorrow.calva")
        exports (await (.activate ext))]
    (.. exports -v1 -repl)))

(defn ^:async sessions+ []
  (js->clj (.listSessions (await (calva-repl+))) :keywordize-keys true))

(defn ^:async connected?+ [session-key]
  (boolean (some #(= session-key (:replSessionKey %)) (await (sessions+)))))

(def ready-checks
  "The code a session evaluates, and the result it gives, when the session is
   ready. The tic-tac-toe page connects before its game scripts have loaded, so
   that session is ready when the game is there."
  {"tic-tac-toe" ["(exists? replicant-tictactoe.core/!store)" "true"]})

(defn ^:async answers?+
  "True when `session-key` gives its ready check's result within two seconds,
   `(+ 1 2)` to 3 unless `ready-checks` has one. A Scittle session waits for its
   page, so it answers only when the Flare is connected."
  [session-key]
  (try
    (let [[code expected] (get ready-checks session-key ["(+ 1 2)" "3"])
          evaluation (await (with-timeout+
                              (.evaluate (await (calva-repl+))
                                         code
                                         #js {:sessionKey session-key
                                              :ns "user"
                                              :who "test-project"
                                              :description "Check that the session is ready"})
                              2000))]
      (= expected (some-> evaluation .-result)))
    (catch :default _
      false)))

(defn ^:async wait-for-answer!+
  "Resolves to `done` when `session-key` answers within `timeout-ms`, or to
   `:timed-out`."
  [session-key done timeout-ms]
  (if (await (wait-for!+ #(answers?+ session-key) timeout-ms))
    done
    :timed-out))

(defn ^:async disconnect!+
  "Disconnects the Calva connection that `session-key` is on, when it is there."
  [session-key]
  (when-let [client-key (->> (await (sessions+))
                             (filter #(= session-key (:replSessionKey %)))
                             first
                             :clientKey)]
    (await (vscode/commands.executeCommand "calva.disconnect" #js {:clientKey client-key}))))

;; The server REPLs

(defn- workspace-root []
  (.. (first vscode/workspace.workspaceFolders) -uri -fsPath))

(defn- port-file [{:keys [projectRootPath nReplPortFile]}]
  (apply path/join (workspace-root) (concat projectRootPath nReplPortFile)))

(defn- server-port
  "The port in the port file of `connect-sequence`, or nil."
  [connect-sequence]
  (let [file (port-file connect-sequence)]
    (when (fs/existsSync file)
      (let [n (js/parseInt (fs/readFileSync file "utf8") 10)]
        (when-not (js/isNaN n) n)))))

(defn ^:async listening?+ [connect-sequence]
  (when-let [port (server-port connect-sequence)]
    (await (port-open?+ port))))

(defn- task-executions [label]
  (filter #(= label (some-> % .-task .-name)) vscode/tasks.taskExecutions))

(defn ^:async start-task!+ [label]
  (when-let [task (->> (await (vscode/tasks.fetchTasks))
                       (filter #(= label (.-name %)))
                       first)]
    (await (vscode/tasks.executeTask task))))

(defn ^:async ensure-server!+
  "Starts the task of a server REPL unless its server listens or its task is
   booting it. Right after a window reload, VS Code has not yet listed the tasks
   that kept running, so the server is asked first. A port file left by a server
   that is gone is deleted before the task starts, so the connect waits for the
   new one. Resolves to `:was-running` or `:started`."
  [{:keys [task connect-sequence]}]
  (if (or (await (listening?+ connect-sequence))
          (seq (task-executions task)))
    :was-running
    (do
      (fs/rmSync (port-file connect-sequence) #js {:force true})
      (await (start-task!+ task))
      :started)))

(defn ^:async server-state+
  "`:listening` when the server answers on the port in its port file,
   `:task-ended` when it doesn't and its task isn't running, else nil."
  [{:keys [task connect-sequence]}]
  (cond
    (await (listening?+ connect-sequence)) :listening
    (empty? (task-executions task)) :task-ended))

(defn ^:async connect-server!+
  "Connects Calva to a server REPL once it listens, unless its session is there.
   Resolves to `:was-connected`, `:connected`, `:task-ended` when the task ended
   before the server listened, `:no-server` when nothing listened within two
   minutes, or `:timed-out`."
  [{:keys [connect-sequence] :as repl}]
  (let [session-key (primary-session connect-sequence)]
    (if (await (connected?+ session-key))
      :was-connected
      (case (await (wait-for!+ #(server-state+ repl) 120000))
        :listening (do
                     ;; Not awaited: the command does not resolve when the session is up.
                     (vscode/commands.executeCommand "calva.connect"
                                                     (clj->js {:connectSequence connect-sequence
                                                               :disableAutoSelect true}))
                     (await (wait-for-answer!+ session-key :connected 60000)))
        :task-ended :task-ended
        :no-server))))

(defn ^:async stop-server!+
  "Terminates the task of a server REPL and waits until the server no longer
   listens. The process exits a few seconds after its task has ended. A server
   that this window's task didn't start, such as one left by a closed window,
   keeps listening. Resolves to `:stopped` or `:still-listening`."
  [{:keys [task connect-sequence]}]
  (doseq [execution (task-executions task)]
    (.terminate execution))
  (if (await (wait-for!+ #(.then (listening?+ connect-sequence) not) 30000))
    :stopped
    :still-listening))

;; Files

(defn- file-tabs [relative]
  (let [file (path/join (workspace-root) relative)]
    (for [group vscode/window.tabGroups.all
          tab (.-tabs group)
          :when (= file (some-> tab .-input .-uri .-fsPath))]
      tab)))

(defn has-tab?
  "True when `relative`, a path in this workspace, has a tab."
  [relative]
  (boolean (seq (file-tabs relative))))

(defn close-file!+
  "Closes the tabs of `relative`, a path in this workspace."
  [relative]
  (vscode/window.tabGroups.close (clj->js (file-tabs relative))))

(defn ^:async open-file!+
  "Opens `relative`, a path in this workspace, in an editor and resolves to the
   session Calva routes it to. Waits for the tab, which VS Code can list a moment
   after the editor shows."
  [relative]
  (let [doc (await (vscode/workspace.openTextDocument
                    (vscode/Uri.file (path/join (workspace-root) relative))))]
    (await (vscode/window.showTextDocument doc #js {:preview true}))
    (await (wait-for!+ #(has-tab? relative) 3000))
    (.currentSessionKey (await (calva-repl+)))))

;; Joyride

(defn- joyride-server-running? []
  (.getContextValue (.-exports (vscode/extensions.getExtension "betterthantomorrow.joyride"))
                    "joyride.isNReplServerRunning"))

(defn ^:async ensure-joyride!+
  "Jacks in to this window's Joyride unless the `joyride` session is there. When
   Joyride's nREPL server runs already, Calva's Joyride jack-in can't start it,
   so Calva connects to it instead. Resolves to `:was-connected`, `:jacked-in`,
   `:connected` or `:timed-out`."
  []
  (cond
    (await (connected?+ "joyride"))
    :was-connected

    (joyride-server-running?)
    (do
      ;; Not awaited: the command does not resolve when the session is up.
      (vscode/commands.executeCommand "calva.connect"
                                      (clj->js {:connectSequence joyride-sequence
                                                :disableAutoSelect true}))
      (await (wait-for-answer!+ "joyride" :connected 60000)))

    :else
    (do
      ;; Not awaited: the command does not resolve when the session is up.
      (vscode/commands.executeCommand "calva.jackIn"
                                      (clj->js {:connectSequence joyride-sequence
                                                :disableAutoSelect true}))
      (await (wait-for-answer!+ "joyride" :jacked-in 60000)))))

;; The tic-tac-toe Flare

(defn ^:async start-websocket-server!+
  "Connects Calva with the tic-tac-toe sequence, which starts Calva's WebSocket
   server, unless the server listens already. Calva makes the `tic-tac-toe`
   session when the Flare's page connects, so this waits for the port only.
   Resolves to `:was-listening`, `:started` or `:timed-out`."
  []
  (if (await (port-open?+ tic-tac-toe-port))
    :was-listening
    (do
      ;; Not awaited: the command resolves when a page has connected.
      (vscode/commands.executeCommand "calva.connect"
                                      (clj->js {:connectSequence tic-tac-toe-sequence
                                                :disableAutoSelect true}))
      (if (await (wait-for!+ #(port-open?+ tic-tac-toe-port) 30000))
        :started
        :timed-out))))

(defn- tic-tac-toe-html []
  [:html
   [:head
    [:script (str "var SCITTLE_NREPL_WEBSOCKET_PORT = " tic-tac-toe-port ";"
                  "var SCITTLE_NREPL_WEBSOCKET_HOST = 'localhost';")]
    [:script {:src (str tic-tac-toe-dir "dist/scittle.js")}]
    [:script {:src (str tic-tac-toe-dir "dist/scittle.nrepl.js")}]
    [:script {:src (str tic-tac-toe-dir "dist/scittle.replicant.js")}]
    [:script {:type "application/x-scittle" :src (str tic-tac-toe-dir "replicant_tictactoe/ui.cljs")}]
    [:script {:type "application/x-scittle" :src (str tic-tac-toe-dir "replicant_tictactoe/game.cljs")}]
    [:script {:type "application/x-scittle" :src (str tic-tac-toe-dir "replicant_tictactoe/core.cljs")}]
    [:link {:rel "stylesheet" :href (str tic-tac-toe-dir "replicant_tictactoe/style.css")}]]
   [:body
    [:h1 "Scittle tic-tac-toe built with Replicant"]
    [:div#app]]])

(defn open-tic-tac-toe!+
  "Opens the tic-tac-toe Flare, or reveals it when it is open. The page stays
   loaded while other editors cover the Flare. It connects to Calva's WebSocket
   server for the `tic-tac-toe` session."
  []
  (flare/flare!+ {:html (tic-tac-toe-html)
                  :title "Tic-tac-toe"
                  :key tic-tac-toe-key
                  :reveal? true
                  :preserve-focus? true
                  :webview-options {:retainContextWhenHidden true}}))

(defn- tic-tac-toe-open? []
  (contains? (flare/ls) tic-tac-toe-key))

(defn ^:async reload-tic-tac-toe!+
  "Closes the tic-tac-toe Flare and opens it again, which loads a new page with a
   new game. Resolves to `:reloaded` when the `tic-tac-toe` session answers from
   the new page, or to `:timed-out`."
  []
  (flare/close! tic-tac-toe-key)
  (await (open-tic-tac-toe!+))
  (await (wait-for-answer!+ "tic-tac-toe" :reloaded 60000)))

(defn ^:async ensure-tic-tac-toe!+
  "Makes the `tic-tac-toe` session answer from the Flare. An open Flare gets
   `grace-ms` to connect, and is reloaded when it doesn't. Resolves to
   `:was-connected`, `:opened`, `:reloaded` or `:timed-out`."
  [grace-ms]
  (let [open? (tic-tac-toe-open?)]
    (cond
      (and open?
           (await (wait-for!+ #(answers?+ "tic-tac-toe") grace-ms)))
      :was-connected

      open?
      (await (reload-tic-tac-toe!+))

      :else
      (do
        (await (open-tic-tac-toe!+))
        (await (wait-for-answer!+ "tic-tac-toe" :opened 60000))))))

;; Start and stop

(defonce !reports
  ;; Each operation's last result, by name, such as "start!", for a run that
  ;; nobody awaited, such as the one when the window opens.
  (atom {}))

(defn ^:async start!
  "Starts the server REPL tasks, jacks in to Joyride, starts Calva's WebSocket
   server and opens the tic-tac-toe Flare, then connects Calva to the server
   REPLs, which have booted meanwhile. Resolves to what each step found or did."
  []
  (let [tasks (await (js/Promise.all (into-array (map ensure-server!+ server-repls))))
        joyride (await (ensure-joyride!+))
        websocket-server (await (start-websocket-server!+))
        tic-tac-toe (when (#{:started :was-listening} websocket-server)
                      (await (ensure-tic-tac-toe!+ 5000)))
        servers (loop [[repl & more] server-repls
                       acc {}]
                  (if repl
                    (recur more (assoc acc
                                       (primary-session (:connect-sequence repl))
                                       (await (connect-server!+ repl))))
                    acc))
        result {:tasks (zipmap (map :task server-repls) tasks)
                :websocket-server websocket-server
                :sessions (cond-> (assoc servers "joyride" joyride)
                            tic-tac-toe (assoc "tic-tac-toe" tic-tac-toe))}]
    (swap! !reports assoc "start!" result)
    (println "test-project/start!" (pr-str result))
    result))

(defn ^:async stop!
  "Closes the tic-tac-toe Flare, disconnects the four sessions, stops Calva's
   WebSocket server, Joyride's nREPL server and the server REPL tasks. Resolves
   to what each step left."
  []
  (flare/close! tic-tac-toe-key)
  (loop [[session-key & more] (seq session-keys)]
    (when session-key
      (await (disconnect!+ session-key))
      (recur more)))
  ;; Closing the page leaves the WebSocket server waiting for it to reconnect.
  (when (await (port-open?+ tic-tac-toe-port))
    (await (vscode/commands.executeCommand "calva.disconnect" #js {:wsServerPort tic-tac-toe-port})))
  (when (joyride-server-running?)
    (await (vscode/commands.executeCommand "joyride.stopNReplServer")))
  (let [servers (loop [[repl & more] server-repls
                       acc {}]
                  (if repl
                    (recur more (assoc acc (:task repl) (await (stop-server!+ repl))))
                    acc))
        sessions-gone? (await (wait-for!+ #(.then (sessions+)
                                                  (fn [sessions]
                                                    (not-any? (comp session-keys :replSessionKey) sessions)))
                                          30000))
        websocket-closed? (not (await (port-open?+ tic-tac-toe-port)))
        result {:sessions (if sessions-gone? :disconnected :still-connected)
                :websocket-server (if websocket-closed? :stopped :still-listening)
                :joyride-nrepl-server (if (joyride-server-running?) :still-running :stopped)
                :servers servers}]
    (swap! !reports assoc "stop!" result)
    (println "test-project/stop!" (pr-str result))
    result))

(comment
  (start!)
  (stop!)
  (sessions+)
  (answers?+ "tic-tac-toe")
  (reload-tic-tac-toe!+)
  @!reports
  :rcf)
