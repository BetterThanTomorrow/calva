(ns calva.repl.webview.image-host
  "Extension-host helpers for output-view images: webview roots, local file URIs, and fetching
   remote bytes for Copy image."
  (:require
   [calva.repl.webview.image-refs :as image-refs]
   [calva.util :as util]
   [clojure.string :as str]))

(defn file-root-uri
  [^js vscode]
  (when-let [uri (some-> vscode .-Uri)]
    (.file uri (if (= "win32" js/process.platform) "C:\\" "/"))))

(defn local-resource-roots
  "Roots that let the output webviews load any local image file, plus the extension itself."
  []
  (let [extension-uri (some-> ^js @util/vscode-context .-extensionUri)
        root (file-root-uri ^js @util/vscode)]
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
               (re-matches #"[A-Za-z]:[\\/].*" s))))

(defn- network-path?
  "UNC (`\\\\server\\...`) or a double-slash host path (`//server/...`)."
  [s]
  (or (str/starts-with? s "\\\\")
      (boolean (re-matches #"//[^/].*" s))))

(defn- blank-authority?
  [^js uri]
  (str/blank? (str (.-authority uri))))

(defn file-uri-for-ref
  "A vscode file URI for a `file:///` URI, an absolute path, or a path relative to the Calva project
   root. Nil for network paths, non-empty authority, missing URI API, a relative path when there is
   no project root, or a URI that Uri.parse cannot build."
  [^js vscode src]
  (try
    (when (and vscode (not (network-path? src)))
      (let [uri (cond
                  (str/starts-with? src "file:")
                  (.. ^js vscode -Uri (parse src))

                  (absolute-path? src)
                  (.. ^js vscode -Uri (file src))

                  :else
                  (when-let [project-root (util/get-project-root-uri)]
                    (reduce (fn [u part]
                              (.. ^js vscode -Uri (joinPath u part)))
                            project-root
                            (remove str/blank? (str/split src #"[\\/]+")))))]
        (when (and uri (blank-authority? uri))
          uri)))
    (catch :default _ nil)))

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

(defn- resolve-local-image-message!
  [^js webview-host post! ^js vscode src]
  (let [file-uri (file-uri-for-ref vscode src)]
    (-> (stat-file! vscode file-uri)
        (.then (fn [uri]
                 (if uri
                   (post! {:command/name "local-image-resolved"
                           :webview-uri (as-webview-image-uri (.-webview webview-host) uri)})
                   (post! {:command/name "local-image-missing"})))))))

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
        vscode @util/vscode
        post! (fn [payload]
                (when webview-host
                  (.. webview-host -webview
                      (postMessage (pr-str (merge {:id id} payload))))))]
    (case command
      "resolve-local-image"
      (resolve-local-image-message! webview-host post! vscode (.-src message))

      "fetch-image-for-copy"
      (fetch-image-for-copy-message! post! (.-url message))

      nil)))

(defn listen-for-webview-messages!
  [^js webview-host]
  (when-let [webview (some-> webview-host .-webview)]
    (when (fn? (.-onDidReceiveMessage webview))
      (.onDidReceiveMessage webview #(handle-webview-message! webview-host %)))))
