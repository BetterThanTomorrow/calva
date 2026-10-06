(ns calva.repl.webview.image-host
  "Extension-host helpers for output-view images: webview roots, local file URIs, and fetching
   remote bytes for Copy image."
  (:require
   [calva.util :as util]
   [clojure.string :as str]))

(defn file-root-uri
  [^js vscode]
  (when-let [uri (some-> vscode .-Uri)]
    (.file uri (if (= "win32" js/process.platform) "C:\\" "/"))))

(defn local-resource-roots
  "Roots that let the output webviews load any local image file, plus the extension itself."
  []
  (let [extension-uri (some-> @util/vscode-context .-extensionUri)
        root (file-root-uri @util/vscode)]
    (to-array (remove nil? [extension-uri root]))))

(defn webview-options
  [command-uri]
  (let [opts #js {:enableScripts true
                  :enableCommandUris #js [command-uri]
                  :localResourceRoots (local-resource-roots)}]
    opts))

(defn- absolute-path?
  [s]
  (boolean (or (str/starts-with? s "/")
               (re-matches #"[A-Za-z]:[\\/].*" s)
               (str/starts-with? s "\\\\"))))

(defn file-uri-for-ref
  "A vscode file URI for a `file://` URI, an absolute path, or a path relative to the Calva project
   root. Nil when there is no URI API or project root for a relative path."
  [^js vscode src]
  (when vscode
    (cond
      (str/starts-with? src "file:")
      (.. ^js vscode -Uri (parse src))

      (absolute-path? src)
      (.. ^js vscode -Uri (file src))

      :else
      (when-let [project-root (util/get-project-root-uri)]
        (reduce (fn [uri part]
                  (.. ^js vscode -Uri (joinPath uri part)))
                project-root
                (remove str/blank? (str/split src #"[\\/]+")))))))

(defn as-webview-image-uri
  "The webview URI for `file-uri`, or nil."
  [^js webview file-uri]
  (when (and webview file-uri)
    (str (.. webview (asWebviewUri file-uri)))))

(defn stat-file!
  "Promise that resolves the URI when the file exists, else nil."
  [^js vscode file-uri]
  (if (and vscode file-uri)
    (-> (.. ^js vscode -workspace -fs (stat file-uri))
        (.then (fn [_] file-uri))
        (.catch (fn [_] nil)))
    (js/Promise.resolve nil)))

(defn bytes->base64
  [bytes]
  (.toString (js/Buffer.from bytes) "base64"))

(defn fetch-image-bytes
  "Promise of `{:mime :base64}` for `url`, or nil when the fetch fails or the body is empty."
  [url]
  (-> (js/fetch url)
      (.then (fn [^js response]
               (if (.-ok response)
                 (-> (.arrayBuffer response)
                     (.then (fn [buffer]
                              {:response response
                               :buffer buffer})))
                 nil)))
      (.then (fn [result]
               (when result
                 (let [{:keys [^js response buffer]} result
                       bytes (js/Uint8Array. buffer)]
                   (when (pos? (.-length bytes))
                     {:mime (or (.get (.-headers response) "content-type")
                                "application/octet-stream")
                      :base64 (bytes->base64 bytes)})))))
      (.catch (fn [_] nil))))

(defn handle-webview-message!
  "Answers resolve-local-image and fetch-image-for-copy from a webview."
  [^js webview-host ^js message]
  (let [command (or (.-command message) (.-command/name message))
        id (.-id message)
        vscode @util/vscode
        post! (fn [payload]
                (when webview-host
                  (.. webview-host -webview
                      (postMessage (pr-str (merge {:id id} payload))))))]
    (case command
      "resolve-local-image"
      (let [src (.-src message)
            file-uri (file-uri-for-ref vscode src)]
        (-> (stat-file! vscode file-uri)
            (.then (fn [uri]
                     (if uri
                       (post! {:command/name "local-image-resolved"
                               :webview-uri (as-webview-image-uri (.-webview webview-host) uri)})
                       (post! {:command/name "local-image-missing"}))))))

      "fetch-image-for-copy"
      (-> (fetch-image-bytes (.-url message))
          (.then (fn [result]
                   (if result
                     (post! (merge {:command/name "image-bytes"} result))
                     (post! {:command/name "image-bytes-missing"})))))

      nil)))

(defn listen-for-webview-messages!
  [^js webview-host]
  (when-let [webview (some-> webview-host .-webview)]
    (when (fn? (.-onDidReceiveMessage webview))
      (.onDidReceiveMessage webview #(handle-webview-message! webview-host %)))))
