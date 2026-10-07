(ns calva.repl.webview.image-host-test
  (:require
   [calva.repl.webview.image-host :as sut]
   [calva.util :as util]
   [cljs.test :refer-macros [deftest testing is async]]
   [clojure.string :as str]))

(defn- fake-uri
  ([authority]
   (fake-uri authority nil))
  ([authority fs-path]
   #js {:authority authority
        :fsPath fs-path
        :toString (fn [] (str "uri:" (or fs-path authority)))}))

(defn- fake-vscode
  ([]
   (fake-vscode nil))
  ([authority-for-parse]
   (let [uri-api #js {:parse (fn [src]
                               (when (str/starts-with? src "file:////")
                                 (throw (js/Error. "path cannot begin with two slash characters")))
                               (fake-uri authority-for-parse src))
                      :file (fn [src]
                              (if (or (str/starts-with? src "//")
                                      (str/starts-with? src "\\\\"))
                                (fake-uri "server" src)
                                (fake-uri "" src)))
                      :joinPath (fn [uri & _parts] uri)}]
     #js {:Uri uri-api})))

(deftest file-uri-for-ref-rejects-network-paths-test
  (testing "UNC and double-slash host paths"
    (is (nil? (sut/file-uri-for-ref (fake-vscode) "\\\\server\\share\\x.png")))
    (is (nil? (sut/file-uri-for-ref (fake-vscode) "//server/share/x.png"))))
  (testing "file URI with a host authority"
    (is (nil? (sut/file-uri-for-ref (fake-vscode "server") "file://server/share/x.png"))))
  (testing "file://// that Uri.parse cannot build returns nil"
    (is (nil? (sut/file-uri-for-ref (fake-vscode) "file:////server/share/x.png"))))
  (testing "file:/// with empty authority is kept"
    (let [uri (sut/file-uri-for-ref (fake-vscode "") "file:///tmp/x.png")]
      (is (some? uri))
      (is (str/blank? (str (.-authority ^js uri)))))))

(deftest file-uri-for-ref-paths-test
  (testing "POSIX absolute path"
    (let [uri (sut/file-uri-for-ref (fake-vscode) "/tmp/x.png")]
      (is (some? uri))
      (is (str/blank? (str (.-authority ^js uri))))))
  (testing "Windows drive path"
    (let [uri (sut/file-uri-for-ref (fake-vscode) "C:\\Users\\pez\\a.png")]
      (is (some? uri))
      (is (str/blank? (str (.-authority ^js uri))))))
  (testing "relative path joined to project root"
    (let [root (fake-uri "")
          vscode (fake-vscode)]
      (with-redefs [util/get-project-root-uri (fn
                                                ([] root)
                                                ([_] root))]
        (is (some? (sut/file-uri-for-ref vscode "charts/a.png"))))))
  (testing "relative path with no project root gives nil"
    (with-redefs [util/get-project-root-uri (fn
                                              ([] nil)
                                              ([_] nil))]
      (is (nil? (sut/file-uri-for-ref (fake-vscode) "charts/a.png"))))))

(deftest image-content-type-test
  (is (= "image/png" (sut/image-content-type "image/png")))
  (is (= "image/jpeg" (sut/image-content-type "image/jpeg; charset=utf-8")))
  (is (nil? (sut/image-content-type "text/html")))
  (is (nil? (sut/image-content-type nil))))

(defn- headers-map
  [m]
  #js {:get (fn [k] (get m (str/lower-case k)))})

(defn- mock-body
  "A ReadableStream-like body from byte vectors (`chunks`), or one that never finishes when
   `:never-ends` is true (rejects when `signal` aborts)."
  [{:keys [chunks never-ends signal]}]
  (let [queue (atom (mapv #(js/Uint8Array. (clj->js %)) (or chunks [])))
        cancelled? (atom false)
        reader #js {:read (fn []
                            (cond
                              @cancelled?
                              (js/Promise.resolve #js {:done true :value nil})

                              never-ends
                              (js/Promise.
                               (fn [_resolve reject]
                                 (let [fail! #(reject (js/Error. "aborted"))]
                                   (if (and signal (.-aborted signal))
                                     (fail!)
                                     (when signal
                                       (.addEventListener signal "abort" fail! #js {:once true}))))))

                              :else
                              (js/Promise.resolve
                               (if-let [chunk (first @queue)]
                                 (do (swap! queue rest)
                                     #js {:done false :value chunk})
                                 #js {:done true :value nil}))))
                    :cancel (fn []
                              (reset! cancelled? true)
                              (js/Promise.resolve nil))}]
    #js {:getReader (fn [] reader)
         :cancel (fn []
                   (reset! cancelled? true)
                   (js/Promise.resolve nil))}))

(defn- mock-response
  [{:keys [ok status headers body-bytes chunks never-ends signal]}]
  (let [chunk-bytes (or chunks
                        (when body-bytes [body-bytes])
                        [])
        body (mock-body {:chunks chunk-bytes
                         :never-ends never-ends
                         :signal signal})]
    #js {:ok ok
         :status status
         :headers (headers-map headers)
         :body body}))

(deftest fetch-image-bytes-refusals-test
  (async done
         (let [calls (atom [])
               prev-display @sut/!image-display-fn]
           (sut/set-image-display-fn! (constantly "images-including-remote-urls"))
           (letfn [(with-fetch [response f]
                     (let [orig js/fetch]
                       (set! js/fetch (fn [url opts]
                                       (swap! calls conj {:url url :opts opts})
                                       (js/Promise.resolve response)))
                       (-> (f)
                           (.finally (fn [] (set! js/fetch orig))))))]
             (-> (js/Promise.resolve nil)
                 (.then (fn [_]
                          (with-fetch (mock-response {:ok false :status 302
                                                      :headers {"content-type" "image/png"}
                                                      :body-bytes [1 2 3]})
                            #(sut/fetch-image-bytes "https://example.com/a.png"))))
                 (.then (fn [result]
                          (is (nil? result) "redirect is refused")
                          (with-fetch (mock-response {:ok true :status 200
                                                      :headers {"content-type" "text/html"}
                                                      :body-bytes [1 2 3]})
                            #(sut/fetch-image-bytes "https://example.com/a.png"))))
                 (.then (fn [result]
                          (is (nil? result) "non-image content-type is refused")
                          (with-fetch (mock-response {:ok true :status 200
                                                      :headers {"content-type" "image/png"
                                                                "content-length" (str (inc sut/max-image-bytes))}
                                                      :body-bytes [1 2 3]})
                            #(sut/fetch-image-bytes "https://example.com/a.png"))))
                 (.then (fn [result]
                          (is (nil? result) "oversize content-length is refused")
                          (with-fetch (mock-response {:ok true :status 200
                                                      :headers {"content-type" "image/png"}
                                                      :body-bytes [9 8 7]})
                            #(sut/fetch-image-bytes "https://example.com/a.png"))))
                 (.then (fn [result]
                          (is (= "image/png" (:mime result)))
                          (is (string? (:base64 result)))
                          (is (= "manual" (some-> @calls last :opts .-redirect)))))
                 (.catch (fn [e]
                           (is false (str e))))
                 (.finally (fn []
                             (sut/set-image-display-fn! prev-display)
                             (done))))))))

(deftest fetch-image-bytes-stream-cap-test
  (async done
         (reset! sut/!max-image-bytes 8)
         (let [orig js/fetch
               !signal (atom nil)]
           (set! js/fetch (fn [_url opts]
                            (reset! !signal (.-signal opts))
                            (js/Promise.resolve
                             (mock-response {:ok true
                                             :status 200
                                             :headers {"content-type" "image/png"}
                                             :chunks [[1 2 3 4] [5 6 7 8] [9]]
                                             :signal (.-signal opts)}))))
           (-> (sut/fetch-image-bytes "https://example.com/big.png")
               (.finally (fn []
                           (set! js/fetch orig)
                           (reset! sut/!max-image-bytes nil)))
               (.then (fn [result]
                        (is (nil? result) "body past cap with no Content-Length is refused")
                        (is (true? (some-> ^js @!signal .-aborted))
                            "fetch signal was aborted")
                        (done)))
               (.catch (fn [e]
                         (is false (str e))
                         (done)))))))

(deftest fetch-image-bytes-timeout-test
  (async done
         (reset! sut/!fetch-timeout-ms 40)
         (let [orig js/fetch
               !signal (atom nil)
               !settled (atom false)
               !guard (atom nil)]
           (reset! !guard
                   (js/setTimeout
                    (fn []
                      (when (compare-and-set! !settled false true)
                        (set! js/fetch orig)
                        (reset! sut/!fetch-timeout-ms nil)
                        (is false "fetch-image-bytes did not settle after the timeout")
                        (done)))
                    1000))
           (set! js/fetch (fn [_url opts]
                            (reset! !signal (.-signal opts))
                            (js/Promise.resolve
                             (mock-response {:ok true
                                             :status 200
                                             :headers {"content-type" "image/png"}
                                             :never-ends true
                                             :signal (.-signal opts)}))))
           (-> (sut/fetch-image-bytes "https://example.com/slow.png")
               (.finally (fn []
                           (set! js/fetch orig)
                           (reset! sut/!fetch-timeout-ms nil)))
               (.then (fn [result]
                        (when (compare-and-set! !settled false true)
                          (js/clearTimeout @!guard)
                          (is (nil? result) "body that never finishes times out")
                          (is (true? (some-> ^js @!signal .-aborted))
                              "fetch signal was aborted")
                          (done))))
               (.catch (fn [e]
                         (when (compare-and-set! !settled false true)
                           (js/clearTimeout @!guard)
                           (is false (str e))
                           (done))))))))

(deftest fetch-image-for-copy-mode-and-url-test
  (let [posted (atom nil)
        host #js {:webview #js {:postMessage (fn [s] (reset! posted s))}}
        prev-display @sut/!image-display-fn]
    (try
      (testing "refuses when display mode is not images-including-remote-urls"
        (sut/set-image-display-fn! (constantly "images"))
        (reset! posted nil)
        (sut/handle-webview-message! host #js {:command "fetch-image-for-copy"
                                               :id "1"
                                               :url "https://example.com/a.png"})
        (is (str/includes? (str @posted) "image-bytes-missing")))
      (testing "refuses a non-http image URL"
        (sut/set-image-display-fn! (constantly "images-including-remote-urls"))
        (reset! posted nil)
        (sut/handle-webview-message! host #js {:command "fetch-image-for-copy"
                                               :id "2"
                                               :url "file:///tmp/a.png"})
        (is (str/includes? (str @posted) "image-bytes-missing")))
      (finally
        (sut/set-image-display-fn! prev-display)))))

(deftest fetch-image-for-copy-empty-response-test
  (async done
         (let [posted (atom nil)
               host #js {:webview #js {:postMessage (fn [s] (reset! posted s))}}
               orig js/fetch
               prev-display @sut/!image-display-fn]
           (sut/set-image-display-fn! (constantly "images-including-remote-urls"))
           (set! js/fetch (fn [_url _opts]
                            (js/Promise.resolve
                             (mock-response {:ok false :status 404
                                             :headers {"content-type" "image/png"}
                                             :body-bytes []}))))
           (reset! posted nil)
           (sut/handle-webview-message! host #js {:command "fetch-image-for-copy"
                                                  :id "3"
                                                  :url "https://example.com/a.png"})
           (js/setTimeout
            (fn []
              (set! js/fetch orig)
              (sut/set-image-display-fn! prev-display)
              (is (str/includes? (str @posted) "image-bytes-missing"))
              (done))
            20))))

(deftest resolve-local-image-message-test
  (async done
         (let [posted (atom nil)
               host #js {:webview #js {:asWebviewUri (fn [uri] (str "webview:" uri))
                                       :postMessage (fn [s] (reset! posted s))}}
               vscode (let [base (fake-vscode)]
                        (set! (.-workspace ^js base)
                              #js {:fs #js {:stat (fn [uri]
                                                    (if (= "" (str (.-authority ^js uri)))
                                                      (js/Promise.resolve #js {})
                                                      (js/Promise.reject (js/Error. "missing"))))}})
                        base)]
           (with-redefs [util/vscode (atom vscode)]
             (reset! posted nil)
             (sut/handle-webview-message! host #js {:command "resolve-local-image"
                                                    :id "exist"
                                                    :src "/tmp/x.png"})
             (js/setTimeout
              (fn []
                (is (str/includes? (str @posted) "local-image-resolved"))
                (reset! posted nil)
                (set! (.. ^js vscode -workspace -fs -stat)
                      (fn [_] (js/Promise.reject (js/Error. "missing"))))
                (sut/handle-webview-message! host #js {:command "resolve-local-image"
                                                       :id "missing"
                                                       :src "/tmp/nope.png"})
                (js/setTimeout
                 (fn []
                   (is (str/includes? (str @posted) "local-image-missing"))
                   (done))
                 20))
              20)))))

(deftest resolve-local-image-file-four-slash-fails-closed-test
  (async done
         (let [posted (atom nil)
               host #js {:webview #js {:asWebviewUri (fn [uri] (str "webview:" uri))
                                       :postMessage (fn [s] (reset! posted s))}}
               vscode (fake-vscode)]
           (with-redefs [util/vscode (atom vscode)]
             (reset! posted nil)
             (sut/handle-webview-message! host #js {:command "resolve-local-image"
                                                    :id "unc"
                                                    :src "file:////server/share/x.png"})
             (js/setTimeout
              (fn []
                (is (str/includes? (str @posted) "local-image-missing")
                    "file://// fails closed and the handler still replies")
                (done))
              20)))))

(deftest resolve-local-image-rejects-non-image-paths-test
  (async done
         (let [posted (atom nil)
               stat-calls (atom 0)
               host #js {:webview #js {:asWebviewUri (fn [uri] (str "webview:" uri))
                                       :postMessage (fn [s] (reset! posted s))}}
               vscode (let [base (fake-vscode)]
                        (set! (.-workspace ^js base)
                              #js {:fs #js {:stat (fn [_uri]
                                                    (swap! stat-calls inc)
                                                    (js/Promise.resolve #js {}))}})
                        base)
               refuse! (fn [id src]
                         (reset! posted nil)
                         (reset! stat-calls 0)
                         (sut/handle-webview-message! host #js {:command "resolve-local-image"
                                                                :id id
                                                                :src src})
                         (js/Promise.
                          (fn [resolve]
                            (js/setTimeout
                             (fn []
                               (is (str/includes? (str @posted) "local-image-missing")
                                   (str "refused: " id))
                               (is (zero? @stat-calls)
                                   (str "stat never called: " id))
                               (resolve nil))
                             20))))]
           (with-redefs [util/vscode (atom vscode)]
             (-> (refuse! "passwd-path" "/etc/passwd")
                 (.then #(refuse! "passwd-uri" "file:///etc/passwd"))
                 (.then #(refuse! "non-string" 42))
                 (.then done))))))

(deftest file-root-uris-test
  (testing "POSIX root"
    (let [roots (sut/file-root-uris (fake-vscode) "darwin")]
      (is (= 1 (count roots)))
      (is (= "/" (.-fsPath ^js (first roots))))))
  (testing "win32 roots for every drive letter"
    (let [roots (sut/file-root-uris (fake-vscode) "win32")
          paths (mapv #(.-fsPath ^js %) roots)]
      (is (= 26 (count paths)))
      (is (= "A:\\" (first paths)))
      (is (= "Z:\\" (last paths))))))
