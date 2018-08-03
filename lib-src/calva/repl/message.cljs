(ns calva.repl.message)


(defn ^:export shadow-cljs-repl-start-code [build]
  (str "(shadow.cljs.devtools.api/nrepl-select " build ")"))


(def operation
  {:EVALUATE "eval"
   :LIST_SESSIONS "ls-sessions"
   :LOAD_FILE "load-file"
   :COMPLETE "complete"
   :CLONE "clone"
   :CLOSE "close"
   :STACKTRACE "stacktrace"
   :INFO "info"
   :REFRESH "refresh"
   :REFRESH_ALL "refresh-all"
   :REFRESH_CLEAR "refresh-clear"
   :FORMAT_CODE "format-code"
   :TEST "test"
   :TEST_ALL "test-all"
   :RETEST "retest"
   :PPRINT "pprint"})

(defn ^:export eval-code-msg [session code]
  {:op (operation :EVALUATE)
   :code code
   :session session})

(defn ^:export startShadowCljsReplMsg [session build]
  {:op (operation :EVALUATE)
   :code (shadow-cljs-repl-start-code build)
   :session session})

(defn ^:export listSessionsMsg []
  {:op (operation :LIST_SESSIONS)})

(defn ^:export evaluateMsg
  ([session ns code]
   (evaluateMsg session ns code false))
  ([session ns code pprint]
   (let [msg {:op (operation :EVALUATE)
              :ns ns
              :code code
              :session session}]
     (if pprint
       (assoc msg :pprint 1)
       msg))))

(defn ^:export formatMsg [session code]
  {:op (operation :PPRINT)
   :code code
   :session session})

(defn ^:export loadFileMsg [session fileContent fileName filePath]
  {:op (operation :LOAD_FILE)
   :file fileContent
   :file-name fileName
   :file-path filePath
   :session session})

(defn ^:export completeMsg [session namespace symbol]
  {:op (operation :COMPLETE)
   :symbol symbol
   :ns namespace
   :session session})

(defn ^:export infoMsg [session namespace symbol]
  {:op (operation :INFO)
   :symbol symbol
   :ns namespace
   :session session})

(defn ^:export stacktraceMsg [session]
  {:op (operation :STACKTRACE)
   :session session})

(defn ^:export cloneMsg [session]
  (let [msg {:op (operation :CLONE)}]
    (if session
      (assoc msg :session session)
      msg)))

(defn ^:export closeMsg [session]
  {:op (operation :CLOSE)
   :session session})

(defn ^:export refreshMsg [session]
  {:op (operation :REFRESH)
   :session session})

(defn ^:export refreshAllMsg [session]
  {:op (operation :REFRESH_ALL)
   :session session})

(defn ^:export refreshClearMsg [session]
  {:op (operation :REFRESH_CLEAR)
   :session session})

(defn ^:export testMsg [session ns]
  {:op (operation :TEST)
   :ns ns
   :session session})

(defn ^:export testAllMsg [session]
  {:op (operation :TEST_ALL)
   :session session
   :load? 1})

(defn ^:export rerunTestsMsg [session]
  {:op (operation :RETEST)
   :session session})
