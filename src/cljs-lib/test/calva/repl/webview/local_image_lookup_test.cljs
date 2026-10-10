(ns calva.repl.webview.local-image-lookup-test
  "Request-id matching for local image lookups in the output webview."
  (:require
   [calva.repl.webview.fake-document]
   [calva.repl.webview.app-db :as app-db]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest testing is]]
   [clojure.string :as str]))

(defn- attr
  [el k]
  (aget (.-attributes el) k))

(defn- first-local-img
  [^js entry]
  (some (fn [form]
          (when (= "images" (attr form "data-image-form"))
            (some (fn [child]
                    (when (some #{"output-images"} (vec (.. child -classList -names)))
                      (some (fn [thumb]
                              (first (filter #(= "IMG" (.-tagName %))
                                             (.-children thumb))))
                            (.-children child))))
                  (.-children form))))
        (.-children entry)))

(defn- with-image-display!
  [display f]
  (let [prev (or (some-> js/document .-body (.getAttribute "data-image-display"))
                 "images-including-remote-urls")]
    (try
      (ui/clear-output-dom (js/document.createElement "div"))
      (ui/set-image-display! display)
      (f)
      (finally
        (ui/set-image-display! prev)
        (ui/clear-output-dom (js/document.createElement "div"))))))

(defn- apply-output!
  [^js host db payload]
  (let [{:uf/keys [fxs]} (app-db/handle-action db [:msg/output payload])]
    (run! #(ui/exec-effect! host %) fxs)
    fxs))

(deftest stale-local-image-reply-after-clear-test
  (testing "a stale reply after clear and re-render applies nothing; the new reply wins"
    (let [posts (atom [])]
      (with-redefs [ui/highlight-code! (fn [_])
                    ui/post-to-host! (fn [msg] (swap! posts conj msg))]
        (with-image-display!
          "images"
          (fn []
            (let [host (js/document.createElement "div")
                  output "\"/tmp/cat.png\""]
              (apply-output! host app-db/initial-db
                             {:command/name "show-result" :output output})
              (let [old-id (:id (first (filter #(= "resolve-local-image" (:command %)) @posts)))]
                (is (some? old-id))
                (ui/clear-output-dom host)
                (reset! posts [])
                (apply-output! host app-db/initial-db
                               {:command/name "show-result" :output output})
                (let [new-msg (first (filter #(= "resolve-local-image" (:command %)) @posts))
                      new-id (:id new-msg)
                      img (first-local-img (aget (.-children host) 0))]
                  (is (some? new-id))
                  (is (not= old-id new-id))
                  (ui/handle-message
                   #js {:data (pr-str {:command/name "local-image-resolved"
                                       :id old-id
                                       :webview-uri "webview:stale"})})
                  (is (not= "webview:stale" (or (.getAttribute img "src") ""))
                      "stale reply does not set the new image")
                  (ui/handle-message
                   #js {:data (pr-str {:command/name "local-image-resolved"
                                       :id new-id
                                       :webview-uri "webview:fresh"})})
                  (is (= "webview:fresh" (.getAttribute img "src"))
                      "new reply wins"))))))))))

(deftest unknown-local-image-reply-id-ignored-test
  (testing "an unknown reply id is ignored"
    (let [posts (atom [])]
      (with-redefs [ui/highlight-code! (fn [_])
                    ui/post-to-host! (fn [msg] (swap! posts conj msg))]
        (with-image-display!
          "images"
          (fn []
            (let [host (js/document.createElement "div")]
              (apply-output! host app-db/initial-db
                             {:command/name "show-result"
                              :output "\"/tmp/cat.png\""})
              (let [img (first-local-img (aget (.-children host) 0))
                    msg (first (filter #(= "resolve-local-image" (:command %)) @posts))]
                (ui/handle-message
                 #js {:data (pr-str {:command/name "local-image-resolved"
                                     :id "no-such-id"
                                     :webview-uri "webview:ghost"})})
                (is (str/blank? (or (.getAttribute img "src") ""))
                    "unknown id leaves the image unset")
                (ui/handle-message
                 #js {:data (pr-str {:command/name "local-image-resolved"
                                     :id (:id msg)
                                     :webview-uri "webview:ok"})})
                (is (= "webview:ok" (.getAttribute img "src")))))))))))

(deftest many-local-image-lookups-leave-nothing-behind-test
  (testing "many resolved lookups leave no waiters or host handlers behind"
    (let [posts (atom [])]
      (with-redefs [ui/highlight-code! (fn [_])
                    ui/post-to-host! (fn [msg] (swap! posts conj msg))]
        (with-image-display!
          "images"
          (fn []
            (let [host (js/document.createElement "div")
                  paths (mapv #(str "/tmp/img-" % ".png") (range 40))]
              (doseq [p paths]
                (apply-output! host app-db/initial-db
                               {:command/name "show-result"
                                :output (pr-str p)}))
              (let [resolves (filterv #(= "resolve-local-image" (:command %)) @posts)]
                (is (= 40 (count resolves)))
                (doseq [msg resolves]
                  (ui/handle-message
                   #js {:data (pr-str {:command/name "local-image-resolved"
                                       :id (:id msg)
                                       :webview-uri (str "webview:" (:src msg))})}))
                (doseq [msg resolves]
                  (ui/handle-message
                   #js {:data (pr-str {:command/name "local-image-resolved"
                                       :id (:id msg)
                                       :webview-uri "webview:replay"})}))
                (let [imgs (keep #(first-local-img (aget (.-children host) %))
                                 (range (.-length (.-children host))))]
                  (is (every? #(not= "webview:replay" (.getAttribute % "src")) imgs)
                      "replayed ids do not re-apply")
                  (is (every? #(str/starts-with? (str (.getAttribute % "src")) "webview:/tmp/img-")
                              imgs)
                      "each image keeps its first resolve"))
                (ui/clear-output-dom host)
                (reset! posts [])
                (apply-output! host app-db/initial-db
                               {:command/name "show-result"
                                :output "\"/tmp/after-clear.png\""})
                (is (= 1 (count (filter #(= "resolve-local-image" (:command %)) @posts)))
                    "after clear, a new lookup still posts once")))))))))
