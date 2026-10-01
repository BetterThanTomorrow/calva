(ns calva.repl.webview.images
  "Base64 image data URL detection for the output views.
   Same pattern and placeholder as `src/results-output/image-data.ts` (text destinations) and
   Backseat Driver `reduce-images`, so all of them agree on what counts as an image."
  (:require
   [clojure.string :as str]))

(def image-data-url-pattern "data:(image/[^;]+);base64,([A-Za-z0-9+/=\\s]+)")

(defn decoded-byte-count
  [base64]
  (let [compact (str/replace base64 #"\s" "")
        padding (cond
                  (str/ends-with? compact "==") 2
                  (str/ends-with? compact "=") 1
                  :else 0)]
    (max 0 (- (js/Math.floor (/ (* 3 (count compact)) 4)) padding))))

(defn format-byte-size
  [bytes]
  (let [kb (js/Math.round (/ bytes 1000))]
    (cond
      (< bytes 1000) (str bytes " B")
      (< kb 1000) (str kb " kB")
      :else (str (js/Math.round (/ bytes 1000000)) " MB"))))

(defn label
  [{:image/keys [n subtype size]}]
  (str "image-" n " " subtype " " size))

(defn placeholder
  [image]
  (str "<<" (label image) ">>"))

(defn extract-images
  "Replaces each base64 image data URL in `text` with `<<image-N TYPE SIZE>>`, numbered from 1.
   Returns `{:text replaced-text :images [image ...]}`, where each image has `:image/n`,
   `:image/mime`, `:image/subtype`, `:image/size` and `:image/data-url` (whitespace removed).
   Whitespace trailing a match is kept after the placeholder."
  [text]
  (if-not (str/includes? text "data:image/")
    {:text text :images []}
    (let [!images (volatile! [])
          replaced (.replace text
                             (js/RegExp. image-data-url-pattern "g")
                             (fn [_match mime base64]
                               (let [image {:image/n (inc (count @!images))
                                            :image/mime mime
                                            :image/subtype (subs mime (count "image/"))
                                            :image/size (format-byte-size (decoded-byte-count base64))
                                            :image/data-url (str "data:" mime ";base64,"
                                                                 (str/replace base64 #"\s" ""))}]
                                 (vswap! !images conj image)
                                 (str (placeholder image) (re-find #"\s*$" base64)))))]
      {:text replaced :images @!images})))
