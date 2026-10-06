(ns calva.repl.webview.image-host-test
  (:require
   [calva.repl.webview.image-host :as sut]
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
