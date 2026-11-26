(ns calva.repl.webview.thumbnail-size-test
  "A remote image gets its src when the display turns to include remote URLs. A loaded image shows its
   thumbnail, and one that can't be shown removes it."
  (:require
   [calva.repl.webview.fake-document :as fake-document]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest testing is]]))

(def image {:image/n 1
            :image/mime "image/png"
            :image/subtype "png"
            :image/size "8 B"
            :image/data-url "data:image/png;base64,iVBORw0KGgo="})

(deftest remote-image-src-set-when-display-includes-remote-urls-test
  (let [body (.-body js/document)
        prev-display (.getAttribute body "data-image-display")
        orig-qsa (.-querySelectorAll js/document)
        remote {:image/n 1
                :image/kind :remote
                :image/src "https://example.com/a.png"
                :image/source "https://example.com/a.png"
                :image/subtype "png"
                :image/mime "image/png"}
        ^js img (.querySelector (fake-document/hiccup-element (ui/image-element remote "images")) "img")]
    (try
      (.setAttribute body "data-image-display" "images")
      (set! (.-querySelectorAll js/document)
            (fn [sel]
              (if (= sel "img[data-image-kind=\"remote\"]")
                #js {:forEach (fn [f] (f img))}
                #js {:forEach (fn [_])})))
      (ui/set-image-display! "images-including-remote-urls")
      (testing "switching to images-including-remote-urls sets the src"
        (is (= "https://example.com/a.png" (.-src img))))
      (finally
        (set! (.-querySelectorAll js/document) orig-qsa)
        (.setAttribute body "data-image-display" prev-display)))))

(deftest image-load-and-error-test
  (let [output (js/document.createElement "div")
        row (fake-document/insert-hiccup! output "beforeend" [:div {:class ["output-images"]}
                                                              (ui/image-element image "images")])
        thumb (.querySelector row "div")
        img (.querySelector row "img")]
    (is (= "true" (.. thumb -dataset -pending)))
    (ui/on-image-load #js {:target img :currentTarget output})
    (is (= "false" (.. thumb -dataset -pending))
        "A loaded image shows its thumbnail")
    (ui/on-image-error #js {:target img})
    (is (nil? (.-parentNode thumb))
        "An image that can't be shown removes its thumbnail")
    (is (zero? (.-childElementCount output))
        "and the row it emptied")))
