(ns calva.repl.webview.inline-images-test
  "Images sit inside the result, directly below the placeholder line."
  (:require
   [calva.repl.webview.fake-document]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest testing is]]))

(def png-data-url "data:image/png;base64,iVBORw0KGgo=")

(def image-1 {:image/n 1
              :image/mime "image/png"
              :image/subtype "png"
              :image/size "8 B"
              :image/data-url png-data-url})

(def image-2 {:image/n 2
              :image/mime "image/png"
              :image/subtype "png"
              :image/size "8 B"
              :image/data-url png-data-url})

(defn- text-of
  [el]
  (cond
    (nil? el) nil
    (some? (.-textContent el)) (.-textContent el)
    :else (apply str (map text-of (.-children el)))))

(defn- class-names
  [el]
  (vec (.. el -classList -names)))

(defn- attr
  [el k]
  (aget (.-attributes el) k))

(defn- images-form
  [^js entry]
  (first (filter #(= "images" (attr % "data-image-form"))
                 (.-children entry))))

(defn- thumbnail-alts
  [^js wrap]
  (for [thumb (.-children wrap)
        child (.-children thumb)
        :when (= "IMG" (.-tagName child))]
    (.-alt child)))

(defn- images-form-outline
  [^js form]
  (for [child (.-children form)]
    (cond
      (= "PRE" (.-tagName child)) [:text (text-of child)]
      (some #{"output-images"} (class-names child)) [:images (vec (thumbnail-alts child))]
      :else [:other (.-tagName child)])))

(deftest nested-map-result-places-images-after-placeholder-lines-test
  (with-redefs [ui/highlight-code! (fn [_])]
    (let [host (js/document.createElement "div")
          text "{:a {:i1 \"<<image-1 png 8 B>>\"\n     :i2 \"<<image-2 png 8 B>>\"}}"
          _ (ui/append-result-with-images host {:text text :raw text :images [image-1 image-2]})
          entry (aget (.-children host) 0)]
      (testing "both images are inside the result entry"
        (is (= ["output-with-images"] (class-names entry))))
      (testing "image 1 is between the :i1 line and the :i2 line, image 2 after :i2"
        (is (= [[:text "{:a {:i1 \"<<image-1 png 8 B>>\"\n"]
                [:images ["image-1 png 8 B"]]
                [:text "     :i2 \"<<image-2 png 8 B>>\"}}"]
                [:images ["image-2 png 8 B"]]]
               (images-form-outline (images-form entry))))))))
