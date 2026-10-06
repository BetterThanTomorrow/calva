(ns calva.repl.webview.lazy-raw-form-test
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

(defn- attr
  [el k]
  (aget (.-attributes el) k))

(defn- form-kinds
  [^js entry]
  (vec (keep #(attr % "data-image-form") (.-children entry))))

(defn- raw-text
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

(deftest lazy-raw-form-test
  (let [highlights (atom 0)]
    (try
      (with-redefs [ui/highlight-code! (fn [_] (swap! highlights inc))]
        (ui/set-image-display! "raw")
        (ui/set-image-display! "images")
        (reset! highlights 0)
        (let [host (js/document.createElement "div")
              raw "\"data:image/png;base64,iVBORw0KGgo=\""
              text "\"<<image-1 png 8 B>>\""]
          (testing "images mode does not build or highlight the raw form"
            (ui/append-result-with-images host {:text text :raw raw :images [image-1]})
            (let [entry (aget (.-children host) 0)]
              (is (= ["images"] (form-kinds entry)))
              (is (= 1 @highlights))))
          (testing "switching to raw builds and highlights the raw form once"
            (ui/set-image-display! "raw")
            (let [entry (aget (.-children host) 0)]
              (is (= ["images" "raw"] (form-kinds entry)))
              (is (= raw (raw-text entry)))
              (is (= 2 @highlights))))
          (testing "toggling back to images and to raw keeps the one raw form"
            (ui/set-image-display! "images")
            (ui/set-image-display! "raw")
            (let [entry (aget (.-children host) 0)]
              (is (= ["images" "raw"] (form-kinds entry)))
              (is (= 2 @highlights))))
          (testing "an entry appended in raw mode has the raw form immediately"
            (ui/append-result-with-images host {:text text :raw raw :images [image-1]})
            (let [entry (aget (.-children host) 1)]
              (is (= ["images" "raw"] (form-kinds entry)))
              (is (= 4 @highlights))))))
      (finally
        (some-> js/document .-body (.setAttribute "data-image-display" "images"))))))

(deftest raw-mode-defers-local-resolve-test
  (let [posts (atom [])]
    (try
      (with-redefs [ui/post-to-host! (fn [msg] (swap! posts conj msg))
                    ui/highlight-code! (fn [_])]
        (ui/set-image-display! "raw")
        (let [host (js/document.createElement "div")
              local {:image/kind :local
                     :image/src "/tmp/cat.png"
                     :image/source "/tmp/cat.png"
                     :image/mime "image/png"
                     :image/subtype "png"}]
          (ui/append-result-with-images host {:text "/tmp/cat.png\n"
                                              :raw "/tmp/cat.png\n"
                                              :images [local]})
          (is (empty? (filter #(= "resolve-local-image" (:command %)) @posts))
              "raw mode does not resolve local images")
          (ui/set-image-display! "images")
          (is (seq (filter #(= "resolve-local-image" (:command %)) @posts))
              "leaving raw resolves pending local images")))
      (finally
        (some-> js/document .-body (.setAttribute "data-image-display" "images"))))))
