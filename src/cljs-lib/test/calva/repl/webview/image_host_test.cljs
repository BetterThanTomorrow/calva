(ns calva.repl.webview.image-host-test
  (:require
   [calva.repl.webview.image-host :as sut]
   [calva.util :as util]
   [cljs.test :refer-macros [deftest testing is async]]
   [clojure.string :as str]))

(defn- fake-uri
  [authority]
  #js {:authority authority})

(defn- fake-vscode
  ([]
   (fake-vscode nil))
  ([authority-for-parse]
   (let [uri-api #js {:parse (fn [_src] (fake-uri authority-for-parse))
                      :file (fn [src]
                              (if (or (str/starts-with? src "//")
                                      (str/starts-with? src "\\\\"))
                                (fake-uri "server")
                                (fake-uri "")))
                      :joinPath (fn [uri & _parts] uri)}]
     #js {:Uri uri-api})))

(deftest file-uri-for-ref-rejects-network-paths-test
  (testing "UNC and double-slash host paths"
    (is (nil? (sut/file-uri-for-ref (fake-vscode) "\\\\server\\share\\x.png")))
    (is (nil? (sut/file-uri-for-ref (fake-vscode) "//server/share/x.png"))))
  (testing "file URI with a host authority"
    (is (nil? (sut/file-uri-for-ref (fake-vscode "server") "file://server/share/x.png"))))
  (testing "file:/// with empty authority is kept"
    (let [uri (sut/file-uri-for-ref (fake-vscode "") "file:///tmp/x.png")]
      (is (some? uri))
      (is (str/blank? (str (.-authority uri)))))))

(deftest file-uri-for-ref-paths-test
  (testing "POSIX absolute path"
    (let [uri (sut/file-uri-for-ref (fake-vscode) "/tmp/x.png")]
      (is (some? uri))
      (is (str/blank? (str (.-authority uri))))))
  (testing "Windows drive path"
    (let [uri (sut/file-uri-for-ref (fake-vscode) "C:\\Users\\pez\\a.png")]
      (is (some? uri))
      (is (str/blank? (str (.-authority uri))))))
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

(defn- mock-response
  [{:keys [ok status headers body-bytes]}]
  (let [arr (js/Uint8Array. (clj->js (or body-bytes [])))
        buffer (.-buffer arr)]
    #js {:ok ok
         :status status
         :headers (headers-map headers)
         :arrayBuffer (fn [] (js/Promise.resolve buffer))}))

(deftest fetch-image-bytes-refusals-test
  (async done
         (let [calls (atom [])]
           (sut/set-image-display-fn! (constantly "images-including-remote-urls"))
           (letfn [(with-fetch [response f]
                     (let [orig js/fetch]
                       (set! js/fetch (fn [url opts]
                                       (swap! calls conj {:url url :opts opts})
                                       (js/Promise.resolve response)))
                       (-> (f)
                           (.then (fn [result]
                                    (set! js/fetch orig)
                                    result))
                           (.catch (fn [e]
                                     (set! js/fetch orig)
                                     (throw e))))))]
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
                          (is (= "manual" (some-> @calls last :opts .-redirect)))
                          (done)))
                 (.catch (fn [e]
                           (is false (str e))
                           (done))))))))

(deftest fetch-image-for-copy-mode-and-url-test
  (let [posted (atom nil)
        host #js {:webview #js {:postMessage (fn [s] (reset! posted s))}}]
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
      (is (str/includes? (str @posted) "image-bytes-missing")))))

(deftest fetch-image-for-copy-empty-response-test
  (async done
         (let [posted (atom nil)
               host #js {:webview #js {:postMessage (fn [s] (reset! posted s))}}
               orig js/fetch]
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
              (is (str/includes? (str @posted) "image-bytes-missing"))
              (done))
            20))))

(deftest resolve-local-image-message-test
  (async done
         (let [posted (atom nil)
               host #js {:webview #js {:asWebviewUri (fn [uri] (str "webview:" uri))
                                       :postMessage (fn [s] (reset! posted s))}}
               vscode (let [base (fake-vscode)]
                        (set! (.-workspace base)
                              #js {:fs #js {:stat (fn [uri]
                                                    (if (= "" (str (.-authority uri)))
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
                (set! (.. vscode -workspace -fs -stat)
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
