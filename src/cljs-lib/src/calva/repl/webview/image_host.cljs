(ns calva.repl.webview.image-host
  "Extension-host helpers for output-view images: webview roots, local file URIs, and fetching
   remote bytes for Copy image."
  (:require
   [calva.repl.webview.image-refs :as image-refs]
   [calva.util :as util]
   [clojure.string :as str]))

(defn- win32-drive-root-uris
  "One Uri.file root per drive letter A-Z on win32."
  [^js uri-api]
  (mapv #(.file uri-api (str % ":\\")) "ABCDEFGHIJKLMNOPQRSTUVWXYZ"))

(defn file-root-uris
  "Filesystem roots for webview localResourceRoots: every drive letter when `platform` is win32, else `/`."
  [^js vscode platform]
  (when-let [uri (some-> vscode .-Uri)]
    (if (= "win32" platform)
      (win32-drive-root-uris uri)
      [(.file uri "/")])))

(defn- workspace-folder-uris
  "URIs of every open workspace folder."
  [^js vscode]
  (when-let [folders (some-> vscode .-workspace .-workspaceFolders)]
    (keep (fn [^js folder] (.-uri folder)) (array-seq folders))))

(defn- non-file-uri?
  "True when `uri` has a scheme other than file."
  [^js uri]
  (and uri (not= "file" (.-scheme uri))))

(defn local-resource-roots
  "Roots for output webview localResourceRoots: the extension, non-file workspace folders,
   and filesystem drive roots. File folders are omitted; drive roots already allow them."
  []
  (let [extension-uri (some-> ^js @util/vscode-context .-extensionUri)
        vscode ^js @util/vscode
        drive-roots (or (file-root-uris vscode js/process.platform) ())
        folder-uris (or (workspace-folder-uris vscode) ())
        remote-folders (filter non-file-uri? folder-uris)]
    (to-array (remove nil? (concat [extension-uri] remote-folders drive-roots)))))

(defn apply-local-resource-roots!
  "Replaces `webview-host`'s localResourceRoots with a fresh rebuild."
  [^js webview-host]
  (when-let [webview (some-> webview-host .-webview)]
    (let [prev (or (.-options webview) #js {})]
      (set! (.-options webview)
            (js/Object.assign #js {} prev #js {:localResourceRoots (local-resource-roots)})))))

(defn listen-for-workspace-folder-changes!
  "Rebuilds localResourceRoots when workspace folders change. Returns a Disposable, or nil."
  [^js webview-host]
  (when-let [vscode ^js @util/vscode]
    (when-let [workspace ^js (.-workspace vscode)]
      (when (fn? (.-onDidChangeWorkspaceFolders workspace))
        (.onDidChangeWorkspaceFolders workspace
                                      (fn [_]
                                        (apply-local-resource-roots! webview-host)))))))

(defn webview-options
  [command-uri]
  (let [opts #js {:enableScripts true
                  :enableCommandUris #js [command-uri]
                  :localResourceRoots (local-resource-roots)}]
    opts))

(defn- absolute-path?
  [s]
  (boolean (or (str/starts-with? s "/")
               (re-matches #"[A-Za-z]:[\\/].*" s))))

(defn- network-path?
  "UNC (`\\\\server\\...`) or a double-slash host path (`//server/...`)."
  [s]
  (or (str/starts-with? s "\\\\")
      (boolean (re-matches #"//[^/].*" s))))

(defn- blank-authority?
  [^js uri]
  (str/blank? (str (.-authority uri))))

(defn- uri-without-authority
  "`uri` when it has an empty authority, else nil."
  [^js uri]
  (when (and uri (blank-authority? uri))
    uri))

(defonce !session-project-root-uri-fn (atom nil))

(defn ^:export set-session-project-root-uri-fn!
  "Registers how the host looks up a REPL session's project-root URI by session key."
  [f]
  (reset! !session-project-root-uri-fn f))

(defn- session-project-root-uri
  "Project-root URI for `session-key`, or nil when the key or lookup is missing."
  [session-key]
  (when-let [f @!session-project-root-uri-fn]
    (when session-key
      (f session-key))))

(defn- project-relative-file-uri
  "Join `src` onto `project-root`. Keeps the root's scheme and authority. Nil when there is no root.
   `..` segments climb out of the root the same way Uri.joinPath does."
  [^js vscode ^js project-root src]
  (when project-root
    (reduce (fn [u part]
              (.. ^js vscode -Uri (joinPath u part)))
            project-root
            (remove str/blank? (str/split src #"[\\/]+")))))

(defn file-uri-for-ref
  "A vscode URI for a `file:///` URI, an absolute path, or a path relative to the producing REPL
   session's project root. Relative paths keep that root's scheme and authority. Nil for network
   paths, user-supplied file: or absolute paths with a non-empty authority, missing URI API, a
   relative path when there is no session root, or a URI that Uri.parse cannot build."
  ([vscode src]
   (file-uri-for-ref vscode src nil))
  ([^js vscode src session-key]
   (try
     (when (and vscode (not (network-path? src)))
       (cond
         (str/starts-with? src "file:")
         (uri-without-authority (.. ^js vscode -Uri (parse src)))

         (absolute-path? src)
         (uri-without-authority (.. ^js vscode -Uri (file src)))

         :else
         (project-relative-file-uri vscode (session-project-root-uri session-key) src)))
     (catch :default _ nil))))

(defn as-webview-image-uri
  "The webview URI for `file-uri`, or nil."
  [^js webview file-uri]
  (when (and webview file-uri)
    (str (.. webview (asWebviewUri file-uri)))))

(def stat-timeout-ms 5000)

(defonce !stat-timeout-ms (atom nil))

(defn- stat-timeout
  []
  (or @!stat-timeout-ms stat-timeout-ms))

(defn stat-file!
  "Promise that resolves the URI when the file exists within the stat timeout, else nil."
  [^js vscode file-uri]
  (if (and vscode file-uri)
    (let [timer (atom nil)
          timeout-p (js/Promise.
                     (fn [resolve]
                       (reset! timer (js/setTimeout #(resolve nil) (stat-timeout)))))
          stat-p (-> (.. ^js vscode -workspace -fs (stat file-uri))
                     (.then (fn [_] file-uri))
                     (.catch (fn [_] nil)))]
      (-> (js/Promise.race #js [stat-p timeout-p])
          (.finally (fn []
                      (when-let [t @timer]
                        (js/clearTimeout t))))))
    (js/Promise.resolve nil)))

(def max-image-bytes (* 20 1024 1024))

(def fetch-timeout-ms 15000)

(defonce !max-image-bytes (atom nil))

(defonce !fetch-timeout-ms (atom nil))

(defn- byte-cap
  []
  (or @!max-image-bytes max-image-bytes))

(defn- timeout-ms
  []
  (or @!fetch-timeout-ms fetch-timeout-ms))

(defonce !image-display-fn (atom nil))

(defn set-image-display-fn!
  "Registers how the host reads the current image display mode (avoids a core require cycle)."
  [f]
  (reset! !image-display-fn f))

(defn- current-image-display
  []
  (when-let [f @!image-display-fn]
    (f)))

(defn image-content-type
  "Bare `image/*` MIME from a Content-Type header, or nil."
  [content-type]
  (when (string? content-type)
    (let [bare (-> content-type (str/split #";") first str/trim str/lower-case)]
      (when (str/starts-with? bare "image/")
        bare))))

(defn- content-length-ok?
  [^js response]
  (let [raw (.get (.-headers response) "content-length")]
    (if raw
      (let [n (js/parseInt raw 10)]
        (and (not (js/isNaN n))
             (<= n (byte-cap))))
      true)))

(defn- cancel-body!
  "Cancels `response`'s body stream when present. Effect: drops unread bytes."
  [^js response]
  (when-let [body (.-body response)]
    (when (fn? (.-cancel body))
      (-> (.cancel body)
          (.catch (fn [_] nil))))))

(defn- concat-chunks
  "One Uint8Array from `chunks`, or nil when empty."
  [chunks total]
  (when (pos? total)
    (let [out (js/Uint8Array. total)
          offset (atom 0)]
      (doseq [^js chunk chunks]
        (.set out chunk @offset)
        (swap! offset + (.-length chunk)))
      out)))

(defn- read-body-capped!
  "Promise of a Uint8Array up to the byte cap, or nil when empty, oversize, or failed.
   Reads `response.body` by chunk; aborts `controller` and returns nil once the count passes the cap."
  [^js response ^js controller]
  (let [body (.-body response)
        cap (byte-cap)]
    (if-not (and body (fn? (.-getReader body)))
      (js/Promise.resolve nil)
      (let [reader (.getReader body)
            chunks (atom [])
            total (atom 0)]
        (letfn [(fail []
                  (-> (.cancel reader)
                      (.catch (fn [_] nil))
                      (.then (fn [_] nil))))
                (step []
                  (-> (.read reader)
                      (.then (fn [^js result]
                               (if (.-done result)
                                 (concat-chunks @chunks @total)
                                 (let [^js value (.-value result)
                                       n (+ @total (.-length value))]
                                   (if (> n cap)
                                     (do
                                       (.abort controller)
                                       (fail))
                                     (do
                                       (reset! total n)
                                       (swap! chunks conj value)
                                       (step)))))))
                      (.catch (fn [_] nil))))]
          (step))))))

(defn bytes->base64
  [bytes]
  (.toString (js/Buffer.from bytes) "base64"))

(defn fetch-image-bytes
  "Promise of `{:mime :base64}` for `url`, or nil when the response redirects, is not image/*, is
   larger than max-image-bytes, times out, or fails. The timeout covers headers and the body read."
  [url]
  (let [controller (js/AbortController.)
        timer (js/setTimeout #(.abort controller) (timeout-ms))]
    (-> (js/fetch url #js {:signal (.-signal controller)
                           :redirect "manual"})
        (.then (fn [^js response]
                 (let [status (.-status response)]
                   (cond
                     (or (not (.-ok response))
                         (<= 300 status 399))
                     (do (cancel-body! response) nil)

                     (not (content-length-ok? response))
                     (do (cancel-body! response) nil)

                     :else
                     (if-let [mime (image-content-type (.get (.-headers response) "content-type"))]
                       (-> (read-body-capped! response controller)
                           (.then (fn [bytes]
                                    (when bytes
                                      {:mime mime
                                       :base64 (bytes->base64 bytes)}))))
                       (do (cancel-body! response) nil))))))
        (.catch (fn [_] nil))
        (.finally (fn [] (js/clearTimeout timer))))))

(defn- allow-remote-copy?
  []
  (= "images-including-remote-urls" (current-image-display)))

(defn- post-image-bytes!
  [post! result]
  (if result
    (post! (merge {:command/name "image-bytes"} result))
    (post! {:command/name "image-bytes-missing"})))

(defn- local-image-src?
  "True when `src` is a string that names a local image file or file:/// image URI."
  [src]
  (and (string? src)
       (or (image-refs/file-image-uri? src)
           (image-refs/image-file-path? src))))

(defn- resolve-local-image-message!
  [^js webview-host post! src session-key]
  (if-not (local-image-src? src)
    (post! {:command/name "local-image-missing"})
    (let [vscode @util/vscode
          file-uri (file-uri-for-ref vscode src session-key)]
      (-> (stat-file! vscode file-uri)
          (.then (fn [uri]
                   (if uri
                     (post! {:command/name "local-image-resolved"
                             :webview-uri (as-webview-image-uri (.-webview webview-host) uri)})
                     (post! {:command/name "local-image-missing"}))))))))

(defn- fetch-image-for-copy-message!
  [post! url]
  (if (and (image-refs/http-image-url? url)
           (allow-remote-copy?))
    (-> (fetch-image-bytes url)
        (.then #(post-image-bytes! post! %)))
    (post! {:command/name "image-bytes-missing"})))

(defn handle-webview-message!
  "Answers resolve-local-image and fetch-image-for-copy from a webview."
  [^js webview-host ^js message]
  (let [command (.-command message)
        id (.-id message)
        post! (fn [payload]
                (when webview-host
                  (.. webview-host -webview
                      (postMessage (pr-str (merge {:id id} payload))))))]
    (case command
      "resolve-local-image"
      (resolve-local-image-message! webview-host post!
                                    (.-src message)
                                    (.-sessionKey message))

      "fetch-image-for-copy"
      (fetch-image-for-copy-message! post! (.-url message))

      nil)))

(defn listen-for-webview-messages!
  [^js webview-host]
  (when-let [webview (some-> webview-host .-webview)]
    (when (fn? (.-onDidReceiveMessage webview))
      (.onDidReceiveMessage webview #(handle-webview-message! webview-host %)))))
