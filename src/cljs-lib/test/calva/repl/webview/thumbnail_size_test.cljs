(ns calva.repl.webview.thumbnail-size-test
  "Thumbnails show images at their natural size and only shrink to fit the view. Node has no layout
   engine, so these tests guard the two inputs that decide the size: the markup `ui` creates and the
   rules in main.css."
  (:require
   [calva.repl.webview.fake-document]
   [calva.repl.webview.ui :as ui]
   [cljs.test :refer-macros [deftest testing is]]
   [clojure.string :as str]
   ["fs" :as fs]))

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

(defn parse-rules
  "The rules of `css` as `{:selectors [...] :declarations {property value}}`, lower-cased. Handles
   flat rules; a nested block's inner rules parse as flat rules."
  [css]
  (for [[_ selectors body] (re-seq #"([^{}]+)\{([^{}]*)\}" (str/replace css #"/\*[\s\S]*?\*/" ""))]
    {:selectors (map str/trim (str/split selectors #","))
     :declarations (into {}
                         (for [declaration (str/split body #";")
                               :let [[property value] (map str/trim (str/split declaration #":" 2))]
                               :when (seq value)]
                           [(str/lower-case property) (str/lower-case value)]))}))

(def thumbnail-selector-re #"\.output-image(?:s|-thumbnail)?(?![\w-])")

(defn targets-img?
  "True when `selector` names a thumbnail class and its last compound matches the thumbnail img."
  [selector]
  (boolean (and (re-find thumbnail-selector-re selector)
                (re-find #"^img(?![\w-])|\.output-image(?![\w-])"
                         (last (str/split selector #"[\s>+~]+"))))))

(defn flex-grows?
  "True when a `flex` shorthand `value` gives a non-zero flex-grow."
  [value]
  (and (some? value)
       (not (contains? #{"none" "initial" "0"} value))
       (not (str/starts-with? value "0 "))))

(defn img-stretches
  "The declarations among `declarations` that can size an img past its natural size."
  [declarations]
  (cond-> {}
    (not (contains? #{nil "auto"} (get declarations "width"))) (assoc "width" (get declarations "width"))
    (not (contains? #{nil "auto"} (get declarations "height"))) (assoc "height" (get declarations "height"))
    (contains? declarations "min-width") (assoc "min-width" (get declarations "min-width"))
    (contains? declarations "min-height") (assoc "min-height" (get declarations "min-height"))
    (contains? declarations "flex-grow") (assoc "flex-grow" (get declarations "flex-grow"))
    (flex-grows? (get declarations "flex")) (assoc "flex" (get declarations "flex"))
    (contains? #{"fill" "cover"} (get declarations "object-fit")) (assoc "object-fit" (get declarations "object-fit"))))

(def main-css (str (fs/readFileSync "repl-output-ui/css/main.css" "utf8")))

(deftest thumbnail-css-keeps-natural-size-test
  (let [rules (parse-rules main-css)
        image-rule (->> rules
                        (filter #(some #{".output-image"} (:selectors %)))
                        (map :declarations)
                        (apply merge))]
    (testing "main.css has an .output-image rule that shrinks the img and keeps its aspect ratio"
      (is (seq image-rule))
      (is (some? (get image-rule "max-width")))
      (is (= "auto" (get image-rule "height"))))
    (testing "no rule for the thumbnail img sizes it past its natural size"
      (is (= {} (into {}
                      (for [{:keys [selectors declarations]} rules
                            selector selectors
                            :when (targets-img? selector)
                            :let [stretches (img-stretches declarations)]
                            :when (seq stretches)]
                        [selector stretches])))))
    (testing "no thumbnail container rule stretches its items"
      (is (= [] (for [{:keys [selectors declarations]} rules
                      selector selectors
                      :when (and (re-find thumbnail-selector-re selector)
                                 (= "stretch" (get declarations "align-items")))]
                  selector))))))

(deftest parse-rules-test
  (is (= [{:selectors [".a" "b .c"] :declarations {"width" "auto" "background" "url(data:x)"}}]
         (parse-rules "/* note */ .a, b .c { Width: AUTO; background: url(data:x) }"))))

(deftest img-stretches-test
  (is (= {} (img-stretches {"width" "auto" "height" "auto" "max-width" "100%" "flex" "0 1 auto"})))
  (is (= {"width" "100%" "flex" "1"} (img-stretches {"width" "100%" "flex" "1"})))
  (is (= {"min-width" "10px" "object-fit" "cover"} (img-stretches {"min-width" "10px" "object-fit" "cover"}))))

(deftest targets-img?-test
  (is (targets-img? ".output-image"))
  (is (targets-img? ".output-image-thumbnail img"))
  (is (targets-img? ".output-image-thumbnail > .output-image:hover"))
  (is (not (targets-img? ".output-greeting img.calva-logo")))
  (is (not (targets-img? ".output-image-copy")))
  (is (not (targets-img? ".output-image-thumbnail:hover .output-image-copy"))))

(deftest output-images-start-at-view-left-edge-test
  (let [rules (parse-rules main-css)
        body-rule (->> rules
                       (filter #(some #{"body"} (:selectors %)))
                       (map :declarations)
                       (apply merge))
        images-rule (->> rules
                         (filter #(some #{".output-images"} (:selectors %)))
                         (map :declarations)
                         (apply merge))
        image-rule (->> rules
                        (filter #(some #{".output-image"} (:selectors %)))
                        (map :declarations)
                        (apply merge))
        inset (get body-rule "--calva-output-inset")]
    (testing "main.css owns the body inline padding as an inset variable"
      (is (some? inset))
      (is (= "var(--calva-output-inset)" (get body-rule "padding-inline"))))
    (testing "thumbnails cancel that inset and never use vw"
      (is (= "calc(-1 * var(--calva-output-inset))" (get images-rule "margin-inline")))
      (is (nil? (get images-rule "margin-inline-start")))
      (is (not-any? #(re-find #"vw" (str %)) (vals images-rule))))
    (testing "the thumbnail img includes its border in max-width"
      (is (= "border-box" (get image-rule "box-sizing"))))))

(deftest remote-image-src-gated-by-display-mode-test
  (let [body (.-body js/document)
        remote {:image/n 1
                :image/kind :remote
                :image/src "https://example.com/a.png"
                :image/source "https://example.com/a.png"
                :image/subtype "png"
                :image/mime "image/png"}]
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
        (is (= "https://example.com/a.png" (.-src img)))))))
