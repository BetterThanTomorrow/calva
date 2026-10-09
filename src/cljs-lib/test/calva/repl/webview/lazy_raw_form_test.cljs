(ns calva.repl.webview.lazy-raw-form-test
  "Dual-form image output through handle-action and exec-effect!, including raw toggle both ways."
  (:require
   [calva.repl.webview.fake-document]
   [calva.repl.webview.app-db :as app-db]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest testing is]]))

(defn- attr
  [el k]
  (aget (.-attributes el) k))

(defn- form-kinds
  [^js entry]
  (vec (keep #(attr % "data-image-form") (.-children entry))))

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
      (ui/clear-output-dom (js/document.createElement "div"))
      (ui/set-image-display! display)
      (f)
      (finally
        (ui/set-image-display! prev)
        (ui/clear-output-dom (js/document.createElement "div"))))))

(deftest dual-form-raw-holds-printed-text-test
  (testing "in raw mode, every image result line shows exact printed text in the raw form"
    (with-redefs [ui/highlight-code! (fn [_])
                  ui/post-to-host! (fn [_])]
      (with-image-display!
        "raw"
        (fn []
          (let [host (js/document.createElement "div")
                result-lines ["\"/tmp/cat.png\""
                              "\"https://example.com/a.png\""]]
            (doseq [output result-lines]
              (apply-output! host app-db/initial-db
                             {:command/name "show-result"
                              :output output}))
            (doseq [[i output] (map-indexed vector result-lines)]
              (let [entry (aget (.-children host) i)]
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
                  output "\"/tmp/cat.png\""]
              (apply-output! host app-db/initial-db
                             {:command/name "show-result"
                              :output output})
              (is (empty? (filter #(= "resolve-local-image" (:command %)) @posts))
                  "raw mode waits to resolve local images")
              (ui/set-image-display! "images-including-remote-urls")
              (is (seq (filter #(= "resolve-local-image" (:command %)) @posts))
                  "leaving raw resolves pending local images")
              (let [entry (aget (.-children host) 0)]
                (is (= ["images" "raw"] (form-kinds entry)))
                (is (= output (result-raw-text entry)))))))))))

(deftest show-stdout-produces-no-image-forms-test
  (testing "show-stdout with a local path produces no data-image-form entries"
    (let [posts (atom [])]
      (with-redefs [ui/highlight-code! (fn [_])
                    ui/post-to-host! (fn [msg] (swap! posts conj msg))]
        (with-image-display!
          "images-including-remote-urls"
          (fn []
            (let [host (js/document.createElement "div")]
              (apply-output! host app-db/initial-db
                             {:command/name "show-stdout"
                              :output "/tmp/cat.png\n"
                              :output-category "evalOut"})
              (let [entry (aget (.-children host) 0)
                    text-node (aget (.-children entry) 0)]
                (is (some? entry))
                (is (= "PRE" (.-tagName entry))
                    "stdout is a plain pre element")
                (is (= "evalOut" (attr entry "data-output-element-type")))
                (is (= "/tmp/cat.png\n" (.-textContent text-node)))
                (is (empty? (filter #(= "resolve-local-image" (:command %)) @posts))
                    "stdout never asks the host to resolve an image")))))))))

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
                       :image/mime "image/png"}
                make-text-el! (fn [t]
                                (let [pre (js/document.createElement "pre")]
                                  (.. pre (appendChild (js/document.createTextNode t)))
                                  pre))]
            (is (thrown? js/Error
                         (ui/append-with-images!
                          host
                          {:text "/tmp/cat.png\n"
                           :images [image]
                           :create-raw-el! #(throw (js/Error. "raw boom"))
                           :create-text-el! make-text-el!})))
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

(deftest repeated-local-paths-post-one-lookup-test
  (testing "repeated identical strings give one row each and one host lookup"
    (let [posts (atom [])]
      (with-redefs [ui/highlight-code! (fn [_])
                    ui/post-to-host! (fn [msg] (swap! posts conj msg))]
        (with-image-display!
          "images"
          (fn []
            (let [host (js/document.createElement "div")
                  output (pr-str ["tmp/a.png" "tmp/a.png"])]
              (apply-output! host app-db/initial-db
                             {:command/name "show-result" :output output})
              (let [entry (aget (.-children host) 0)
                    img (first-local-img entry)
                    thumbs (some-> img .-parentNode .-parentNode .-children .-length)
                    resolves (filter #(= "resolve-local-image" (:command %)) @posts)]
                (is (some? img))
                (is (= 2 thumbs)
                    "each matching string still gets a row")
                (is (= 1 (count resolves))
                    "one host lookup per unique path")))))))))

(deftest nested-missing-image-removes-thumbnail-test
  (testing "a nested image path that does not resolve leaves no empty row"
    (let [posts (atom [])]
      (with-redefs [ui/highlight-code! (fn [_])
                    ui/post-to-host! (fn [msg] (swap! posts conj msg))]
        (with-image-display!
          "images"
          (fn []
            (let [host (js/document.createElement "div")
                  output (pr-str {:icon "missing-image.png"})]
              (apply-output! host app-db/initial-db
                             {:command/name "show-result" :output output})
              (let [entry (aget (.-children host) 0)
                    img (first-local-img entry)
                    msg (first (filter #(= "resolve-local-image" (:command %)) @posts))]
                (is (some? img)
                    "images mode shows a thumbnail while the host looks up the path")
                (is (some? msg))
                (ui/handle-message #js {:data (pr-str {:command/name "local-image-missing"
                                                       :id (:id msg)})})
                (is (nil? (first-local-img entry))
                    "the thumbnail is removed")
                (let [form (first (filter #(= "images" (attr % "data-image-form"))
                                          (.-children entry)))
                      outline (for [child (.-children form)]
                                (cond
                                  (= "PRE" (.-tagName child)) :text
                                  (some #{"output-images"}
                                        (vec (.. child -classList -names))) :images
                                  :else :other))]
                  (is (= [:text] (vec outline))
                      "no empty image row is left"))))))))))

(deftest nested-result-image-strings-toggle-modes-test
  (testing "a result with nested image strings keeps dual forms across all three modes"
    (with-redefs [ui/highlight-code! (fn [_])
                  ui/post-to-host! (fn [_])]
      (with-image-display!
        "images-including-remote-urls"
        (fn []
          (let [host (js/document.createElement "div")
                output (pr-str {:icon "calva-symbol.svg" :logo "https://example.com/x.png"})]
            (apply-output! host app-db/initial-db
                           {:command/name "show-result" :output output})
            (let [entry (aget (.-children host) 0)]
              (is (= ["images"] (form-kinds entry))
                  "nested matches create an images form")
              (ui/set-image-display! "images")
              (is (= ["images"] (form-kinds entry))
                  "images mode keeps the images form")
              (ui/set-image-display! "raw")
              (is (= ["images" "raw"] (form-kinds entry))
                  "raw adds the printed text form")
              (is (= output (result-raw-text entry))
                  "raw shows the result exactly as printed")
              (ui/set-image-display! "images-including-remote-urls")
              (is (= ["images" "raw"] (form-kinds entry))
                  "returning to remote mode keeps both forms"))))))))
