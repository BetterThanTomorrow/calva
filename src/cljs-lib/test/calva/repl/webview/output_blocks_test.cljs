(ns calva.repl.webview.output-blocks-test
  "The output blocks' hiccup."
  (:require
   [calva.repl.webview.fake-document]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest is]]
   [lookup.core :as l]))

(defn- written-attrs
  "Returns the attributes of `element` that Replicant writes, those with a value."
  [element]
  (into {} (filter (comp some? val)) (l/attrs element)))

(deftest ns-info-element-test
  (let [hiccup (ui/ns-info-element {:meta/who "clj"
                                    :meta/repl-session-key "cljs"
                                    :meta/shadow-build ":app"
                                    :meta/ns "user"})]
    (is (= [{:class #{"ns-info-container"} :data-output-element-type "ns-info"}]
           (map l/attrs (l/select :div hiccup))))
    (is (= [["clj" #{"ns-info-badge" "ns-info-who"}]
            ["cljs :app" #{"ns-info-badge" "ns-info-session"}]
            ["user" #{"ns-info-badge" "ns-info-ns"}]]
           (map (juxt l/text (comp :class l/attrs)) (l/select :span hiccup)))
        "The badges show who, the session and the namespace"))
  (is (= ["user"]
         (map l/text (l/select :span (ui/ns-info-element {:meta/who "ui" :meta/ns "user"}))))
      "The REPL Input's evaluations show no who badge"))

(deftest evaluated-code-element-test
  (let [hiccup (ui/evaluated-code-element "(+ 1 2)")]
    (is (seq (l/select :div.evaluated-code-container hiccup)))
    (is (= ["Evaluated code"] (map l/text (l/select :span.border-text hiccup))))
    (is (= ["(+ 1 2)"] (map l/text (l/select '[pre > code.language-clojure] hiccup)))
        "The code is in a pre, for highlight.js")))

(deftest stdout-element-test
  (let [hiccup (ui/stdout-element "hello\n" "evalErr")
        [pre] (l/select :pre hiccup)]
    (is (= {:class #{"output-stdout"} :data-output-element-type "evalErr"} (l/attrs pre)))
    (is (= [:button "hello\n"] (map #(if (vector? %) (first %) %) (l/children pre)))
        "The copy button comes before the text")
    (is (= [{:type "button"
             :class #{"output-copy-button" "output-stdout-copy"}
             :aria-label "Copy output"
             :data-copy-label "Copy output"
             :interestfor "output-tooltip"
             :aria-description "Copy output"
             :data-action "[[:output/ax.copy-stdout :event/target]]"}]
           (map l/attrs (l/select :button hiccup)))
        "The copy button has the page's tooltip and copies through its action")))

(def png-data-url "data:image/png;base64,iVBORw0KGgo=")

(def data-url-image {:image/n 1
                     :image/mime "image/png"
                     :image/subtype "png"
                     :image/size "8 B"
                     :image/data-url png-data-url})

(def remote-image {:image/n 2
                   :image/kind :remote
                   :image/src "https://example.com/a.png"
                   :image/source "https://example.com/a.png"
                   :image/subtype "png"
                   :image/mime "image/png"})

(def local-image {:image/n 3
                  :image/kind :local
                  :image/src "/tmp/cat.png"
                  :image/source "/tmp/cat.png"
                  :image/subtype "png"
                  :image/mime "image/png"})

(defn- img-attrs
  [image display]
  (written-attrs (first (l/select :img (ui/image-element image display)))))

(deftest image-element-test
  (let [hiccup (ui/image-element data-url-image "images")]
    (is (= [{:class #{"output-image-thumbnail"} :data-pending "true"}]
           (map written-attrs (l/select :.output-image-thumbnail hiccup)))
        "The thumbnail waits for its image to load")
    (is (= {:class #{"output-image"} :alt "image-1 png 8 B" :title "image-1 png 8 B" :src png-data-url}
           (img-attrs data-url-image "images"))
        "The img has no size of its own")
    (is (= [{:type "button"
             :class #{"output-copy-button" "output-image-copy"}
             :aria-label "Copy image-1 png 8 B"
             :data-copy-label "Copy image-1 png 8 B"
             :interestfor "output-tooltip"
             :aria-description "Copy image"
             :data-action (pr-str [[:output/ax.copy-image {:image/mime "image/png" :copy/button :event/target}]])}]
           (map written-attrs (l/select :button hiccup)))
        "The copy button has the page's tooltip and copies through its action")))

(deftest image-element-sources-test
  (is (= {:class #{"output-image"}
          :alt "image-3 png"
          :title "image-3 png"
          :data-image-kind "local"
          :data-local-src "/tmp/cat.png"}
         (img-attrs local-image "images"))
      "A local image gets its src from its lookup")
  (is (nil? (:src (img-attrs remote-image "images")))
      "A remote image doesn't load in the images display")
  (is (= ["https://example.com/a.png" "https://example.com/a.png"]
         ((juxt :src :data-remote-src) (img-attrs remote-image "images-including-remote-urls")))
      "A remote image loads when the display includes remote URLs"))

(deftest images-form-element-test
  (let [hiccup (ui/images-form-element [{:text "{:a \"<<image-1 png 8 B>>\"\n"
                                         :images [data-url-image]}
                                        {:text " :b 2}"}]
                                       "images")]
    (is (= [:pre :div :pre]
           (map first (l/children (first (l/select "[data-image-form]" hiccup)))))
        "The images of a line come right after it")
    (is (= ["{:a \"<<image-1 png 8 B>>\"\n" " :b 2}"]
           (map l/text (l/select :code.language-clojure hiccup))))
    (is (= 1 (count (l/select [:.output-images :.output-image-thumbnail] hiccup))))))
