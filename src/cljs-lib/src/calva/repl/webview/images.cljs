(ns calva.repl.webview.images
  "Base64 image data URL detection for the output views.
   Same pattern and placeholder as `src/results-output/image-data.ts` (text destinations) and
   Backseat Driver `reduce-images`, so all of them agree on what counts as an image."
  (:require
   [clojure.string :as str]))

(def image-data-url-pattern "data:(image/[^;]+);base64,([A-Za-z0-9+/=\\s]+)")

(def wrap-widths #{64 76})

(defn- base64-char?
  [c]
  (boolean (and c (re-matches #"[A-Za-z0-9+/]" c))))

(defn- line-break-length
  [text i]
  (cond
    (= "\n" (get text i)) 1
    (and (= "\r" (get text i)) (= "\n" (get text (inc i)))) 2
    :else 0))

(defn- wrap-break-length
  "Length of the line break at `i` when it wraps base64, otherwise 0. `width` is the wrap width set
   by the first wrapped line, if any."
  [text i line-length width]
  (let [break-length (line-break-length text i)
        full-line? (if width (= width line-length) (contains? wrap-widths line-length))]
    (if (and full-line? (base64-char? (get text (+ i break-length))))
      break-length
      0)))

(defn base64-payload-end
  "Index where the base64 payload starting at `start` ends: right after `=` padding, or at the
   first character outside the base64 alphabet. A line break continues the payload when it wraps
   base64: the line before it is 64 or 76 characters (later lines the same width as the first)
   and more base64 follows."
  [text start]
  (loop [i start
         line-start start
         width nil]
    (let [c (get text i)]
      (cond
        (nil? c) i
        (base64-char? c) (recur (inc i) line-start width)
        (= "=" c) (if (= "=" (get text (inc i))) (+ i 2) (inc i))
        :else (let [line-length (- i line-start)
                    break-length (wrap-break-length text i line-length width)]
                (if (pos? break-length)
                  (recur (+ i break-length) (+ i break-length) line-length)
                  i))))))

(defn image-data-urls
  "Base64 image data URLs in `text`, as `{:start :end :mime :base64}`. The pattern finds where each
   one starts; `base64-payload-end` decides where it ends, and the search resumes there."
  [text]
  (let [re (js/RegExp. image-data-url-pattern "g")]
    (loop [found []]
      (if-let [match (.exec re text)]
        (let [mime (aget match 1)
              start (.-index match)
              payload-start (+ start (count (str "data:" mime ";base64,")))
              end (base64-payload-end text payload-start)]
          (set! (.-lastIndex re) end)
          (recur (cond-> found
                   (> end payload-start) (conj {:start start
                                                :end end
                                                :mime mime
                                                :base64 (subs text payload-start end)}))))
        found))))

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
   `:image/mime`, `:image/subtype`, `:image/size` and `:image/data-url` (whitespace removed)."
  [text]
  (if-not (str/includes? text "data:image/")
    {:text text :images []}
    (let [found (image-data-urls text)
          images (map-indexed (fn [i {:keys [mime base64]}]
                                {:image/n (inc i)
                                 :image/mime mime
                                 :image/subtype (subs mime (count "image/"))
                                 :image/size (format-byte-size (decoded-byte-count base64))
                                 :image/data-url (str "data:" mime ";base64,"
                                                      (str/replace base64 #"\s" ""))})
                              found)
          ends (cons 0 (map :end found))
          pieces (mapcat (fn [rest-start {:keys [start]} image]
                           [(subs text rest-start start) (placeholder image)])
                         ends found images)]
      {:text (apply str (concat pieces [(subs text (last ends))]))
       :images (vec images)})))
