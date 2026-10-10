(ns calva.repl.webview.thumbnail-size-test
  "The thumbnail img carries no size of its own. A remote image gets its src only when the display mode includes remote URLs."
  (:require
   [calva.repl.webview.fake-document]
   [calva.repl.webview.ui :as ui]
   [clojure.string :as str]
   [cljs.test :refer-macros [deftest testing is]]))

(def image {:image/n 1
            :image/mime "image/png"
            :image/subtype "png"
            :image/size "8 B"
            :image/data-url "data:image/png;base64,iVBORw0KGgo="})

(deftest thumbnail-markup-leaves-size-to-css-test
  (let [^js img (->> (.-children (ui/create-image-element image))
                     (filter #(= "IMG" (.-tagName ^js %)))
                     first)]
    (testing "the thumbnail has an img with the output-image class"
      (is (some? img))
      (is (= ["output-image"] (vec (.. img -classList -names)))))
    (testing "the img has no size attributes"
      (is (= [] (filter #(some? (aget (.-attributes img) %)) ["width" "height" "style"]))))
    (testing "the img has no size properties"
      (is (nil? (.-width img)))
      (is (nil? (.-height img))))
    (testing "the img has no inline style"
      (is (= [] (vec (js-keys (.-style img))))))))

(deftest remote-image-src-gated-by-display-mode-test
  (let [body (.-body js/document)
        prev-display (.getAttribute body "data-image-display")
        orig-qsa (.-querySelectorAll js/document)
        remote {:image/n 1
                :image/kind :remote
                :image/src "https://example.com/a.png"
                :image/source "https://example.com/a.png"
                :image/subtype "png"
                :image/mime "image/png"}]
    (try
      (.setAttribute body "data-image-display" "images")
      (let [^js thumb (ui/create-image-element remote)
            ^js img (->> (.-children thumb)
                         (filter #(= "IMG" (.-tagName ^js %)))
                         first)]
        (testing "images mode leaves remote img src unset"
          (is (str/blank? (str (.-src img))))
          (is (= "https://example.com/a.png" (.-calvaRemoteSrc img))))
        (set! (.-querySelectorAll js/document)
              (fn [sel]
                (if (= sel "img[data-image-kind=\"remote\"]")
                  #js {:forEach (fn [f] (f img))}
                  #js {:forEach (fn [_])})))
        (ui/set-image-display! "images-including-remote-urls")
        (testing "switching to images-including-remote-urls sets the src"
          (is (= "https://example.com/a.png" (.-src img)))))
      (finally
        (set! (.-querySelectorAll js/document) orig-qsa)
        (if prev-display
          (.setAttribute body "data-image-display" prev-display)
          (.removeAttribute body "data-image-display"))))))

(defn- img-listener
  [^js img type]
  (some (fn [entry]
          (when (= type (.-type entry))
            entry))
        (.-calvaListeners img)))

(defn- thumbnail-img
  [^js thumb]
  (first (filter #(= "IMG" (.-tagName ^js %))
                 (.-children thumb))))

(deftest data-url-error-removes-thumbnail-test
  (let [thumb (ui/create-image-element image)
        img (thumbnail-img thumb)
        parent (js/document.createElement "div")
        error-listener (img-listener img "error")
        load-listener (img-listener img "load")]
    (testing "the error and load listeners are installed before src is set"
      (is (fn? (.-f error-listener)))
      (is (fn? (.-f load-listener)))
      (is (nil? (.-src-when-added error-listener)))
      (is (nil? (.-src-when-added load-listener)))
      (is (= (:image/data-url image) (.-src img)))
      (is (= "true" (.. thumb -dataset -pending))))
    (testing "load clears the pending flag"
      ((.-f load-listener))
      (is (= "false" (.. thumb -dataset -pending))))
    (testing "error removes the thumbnail"
      (.appendChild parent thumb)
      ((.-f error-listener))
      (is (nil? (.-parentNode thumb)))
      (is (zero? (.-childElementCount parent))))))
