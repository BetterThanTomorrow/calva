(ns calva.repl.webview.lazy-raw-form-test
  "Dual-form image output through handle-action and exec-effect!, including raw toggle both ways."
  (:require
   [calva.repl.webview.fake-document]
   [calva.repl.webview.app-db :as app-db]
   [calva.repl.webview.ui :as ui]
   [clojure.string :as str]
   [cljs.test :refer-macros [deftest testing is]]))

(def png-data-url "data:image/png;base64,iVBORw0KGgo=")

(defn- attr
  [el k]
  (aget (.-attributes el) k))

(defn- form-kinds
  [^js entry]
  (vec (keep #(attr % "data-image-form") (.-children entry))))

(defn- stdout-raw-text
  [^js entry]
  (some (fn [child]
          (when (= "raw" (attr child "data-image-form"))
            (some-> (aget (.-children child) 0)
                    .-children
                    (aget 0)
                    .-textContent)))
        (.-children entry)))

(defn- result-raw-text
  [^js entry]
  (some (fn [child]
          (when (= "raw" (attr child "data-image-form"))
            (some-> (aget (.-children child) 0)
                    .-children
                    (aget 0)
                    .-children
                    (aget 0)
                    .-textContent)))
        (.-children entry)))

(defn- apply-output!
  [^js host db payload]
  (let [{:uf/keys [fxs]} (app-db/handle-action db [:msg/output payload])]
    (run! #(ui/exec-effect! host %) fxs)
    fxs))

(defn- with-image-display!
  [display f]
  (let [prev (or (some-> js/document .-body (.getAttribute "data-image-display"))
                 "images-including-remote-urls")]
    (try
      (ui/set-image-display! display)
      (f)
      (finally
        (ui/set-image-display! prev)))))

(deftest dual-form-raw-holds-printed-text-test
  (testing "in raw mode, every image stderr and result line shows exact printed text in the raw form"
    (with-redefs [ui/highlight-code! (fn [_])
                  ui/post-to-host! (fn [_])]
      (with-image-display!
        "raw"
        (fn []
          (let [host (js/document.createElement "div")
                stderr-lines ["/tmp/no-such-image.png\n"
                              "https://example.com/a.png\n"
                              "/tmp/calva-symbol.svg\n"
                              (str png-data-url "\n")]
                result-lines ["\"/tmp/cat.png\""
                              "\"https://example.com/a.png\""]]
            (doseq [output stderr-lines]
              (apply-output! host app-db/initial-db
                             {:command/name "show-stdout"
                              :output output
                              :output-category "evalErr"}))
            (doseq [output result-lines]
              (apply-output! host app-db/initial-db
                             {:command/name "show-result"
                              :output output}))
            (doseq [[i output] (map-indexed vector stderr-lines)]
              (let [entry (aget (.-children host) i)]
                (is (= ["images" "raw"] (form-kinds entry))
                    (str "stderr dual form: " output))
                (is (= output (stdout-raw-text entry))
                    (str "raw mode appends stderr as plain text: " output))))
            (doseq [[i output] (map-indexed vector result-lines)]
              (let [entry (aget (.-children host) (+ (count stderr-lines) i))]
                (is (= ["images" "raw"] (form-kinds entry))
                    (str "result dual form: " output))
                (is (= output (result-raw-text entry))
                    (str "raw mode appends result as plain text: " output))))))))))

(deftest toggle-from-raw-shows-thumbnails-test
  (testing "output printed in raw gets thumbnails after toggling to images-including-remote-urls"
    (let [posts (atom [])]
      (with-redefs [ui/highlight-code! (fn [_])
                    ui/post-to-host! (fn [msg] (swap! posts conj msg))]
        (with-image-display!
          "raw"
          (fn []
            (let [host (js/document.createElement "div")
                  output "/tmp/cat.png\n"]
              (apply-output! host app-db/initial-db
                             {:command/name "show-stdout"
                              :output output
                              :output-category "evalOut"})
              (is (empty? (filter #(= "resolve-local-image" (:command %)) @posts))
                  "raw mode waits to resolve local images")
              (ui/set-image-display! "images-including-remote-urls")
              (is (seq (filter #(= "resolve-local-image" (:command %)) @posts))
                  "leaving raw resolves pending local images")
              (let [entry (aget (.-children host) 0)]
                (is (= ["images" "raw"] (form-kinds entry)))
                (is (= output (stdout-raw-text entry)))))))))))

(deftest toggle-to-raw-shows-printed-text-test
  (testing "output printed in an image mode shows as plain text after toggling to raw"
    (let [highlights (atom 0)]
      (with-redefs [ui/highlight-code! (fn [_] (swap! highlights inc))
                    ui/post-to-host! (fn [_])]
        (with-image-display!
          "images-including-remote-urls"
          (fn []
            (let [host (js/document.createElement "div")
                  output "\"https://example.com/a.png\""]
              (reset! highlights 0)
              (apply-output! host app-db/initial-db
                             {:command/name "show-result"
                              :output output})
              (let [entry (aget (.-children host) 0)]
                (is (= ["images"] (form-kinds entry))
                    "one form at append time in image mode")
                (is (= 1 @highlights)
                    "image mode does not highlight the raw text")
                (ui/set-image-display! "raw")
                (is (= ["images" "raw"] (form-kinds entry))
                    "both forms after switching to raw")
                (is (= output (result-raw-text entry))
                    "raw form holds the printed text after toggle")
                (is (= 2 @highlights)
                    "switching to raw highlights the raw form once")))))))))

(deftest append-keeps-entry-when-raw-form-throws-test
  (testing "a throw while building the raw form leaves the images entry in the page"
    (with-redefs [ui/post-to-host! (fn [_])]
      (with-image-display!
        "raw"
        (fn []
          (let [host (js/document.createElement "div")
                image {:image/n 1
                       :image/kind :local
                       :image/src "/tmp/cat.png"
                       :image/source "/tmp/cat.png"
                       :image/subtype "png"
                       :image/mime "image/png"}]
            (is (thrown? js/Error
                         (ui/append-with-images!
                          host
                          {:text "/tmp/cat.png\n"
                           :images [image]
                           :create-raw-el! #(throw (js/Error. "raw boom"))
                           :create-text-el! #(ui/create-stdout-element % "evalOut")})))
            (is (= 1 (.-length (.-children host)))
                "images form still lands when raw form throws")
            (is (= ["images"] (form-kinds (aget (.-children host) 0))))))))))

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

(defn- complete-local-resolve!
  "Simulates the host's local-image-resolved reply for one posted request."
  [posts img]
  (when-let [msg (first (filter #(and (= "resolve-local-image" (:command %))
                                      (= (.-calvaLocalSrc img) (:src %)))
                                @posts))]
    (set! (.-src img) (str "webview:" (:src msg)))
    (.setAttribute img "src" (str "webview:" (:src msg)))
    (when-let [thumb (.-parentNode img)]
      (set! (.. thumb -dataset -pending) "false"))
    msg))

(deftest toggle-from-raw-resolves-local-stdout-and-stderr-test
  (testing "local paths printed in raw get an image row after switching to an image mode"
    (let [posts (atom [])]
      (with-redefs [ui/highlight-code! (fn [_])
                    ui/post-to-host! (fn [msg] (swap! posts conj msg))]
        (with-image-display!
          "raw"
          (fn []
            (let [host (js/document.createElement "div")
                  out-path "/tmp/out-symbol.svg\n"
                  err-path "/tmp/err-symbol.svg\n"]
              (apply-output! host app-db/initial-db
                             {:command/name "show-stdout"
                              :output out-path
                              :output-category "evalOut"})
              (apply-output! host app-db/initial-db
                             {:command/name "show-stdout"
                              :output err-path
                              :output-category "evalErr"})
              (let [out-entry (aget (.-children host) 0)
                    err-entry (aget (.-children host) 1)
                    out-img (first-local-img out-entry)
                    err-img (first-local-img err-entry)]
                (is (some? out-img))
                (is (some? err-img))
                ;; Browser IDL may report a non-blank src while the content attribute is still
                ;; unset; the mode-change path must still resolve (this fails on tip 6489df61b).
                (set! (.-src out-img) "https://example.invalid/")
                (set! (.-src err-img) "https://example.invalid/")
                (ui/set-image-display! "images-including-remote-urls")
                (let [resolves (filter #(= "resolve-local-image" (:command %)) @posts)]
                  (is (= 2 (count resolves))
                      "mode change resolves stdout and stderr local paths")
                  (is (complete-local-resolve! posts out-img))
                  (is (complete-local-resolve! posts err-img))
                  (doseq [[entry img path] [[out-entry out-img out-path]
                                            [err-entry err-img err-path]]]
                    (is (str/starts-with? (str (.getAttribute img "src")) "webview:")
                        (str "host resolve reply sets src: " path))
                    (let [form (first (filter #(= "images" (attr % "data-image-form"))
                                              (.-children entry)))
                          outline (for [child (.-children form)]
                                    (cond
                                      (= "PRE" (.-tagName child)) :text
                                      (some #{"output-images"}
                                            (vec (.. child -classList -names))) :images
                                      :else :other))]
                      (is (= [:text :images] (vec outline))
                          (str "image row follows the source line: " path)))))))))))))

(deftest clear-output-dom-drops-pending-local-resolves-test
  (let [posts (atom [])]
    (with-redefs [ui/post-to-host! (fn [msg] (swap! posts conj msg))
                  ui/highlight-code! (fn [_])]
      (with-image-display!
        "raw"
        (fn []
          (let [host (js/document.createElement "div")]
            (apply-output! host app-db/initial-db
                           {:command/name "show-result"
                            :output "\"/tmp/cat.png\""})
            (ui/clear-output-dom host)
            (ui/set-image-display! "images")
            (is (empty? (filter #(= "resolve-local-image" (:command %)) @posts))
                "clear-output-dom drops queued local resolves")))))))
