(ns calva.repl.webview.images
  "Base64 image data URL detection for the output views. The pattern starts from Backseat Driver
   `reduce-images`, with the image subtype restricted to MIME token characters so a match cannot
   run across prose to a later `;base64,`. Optional `;name=value` MIME parameters (token characters
   only) may sit between the image type and ;base64."
  (:require
   [clojure.string :as str]))

(def image-data-url-pattern "data:(image/[A-Za-z0-9.+-]+)(?:;[A-Za-z0-9.+-]+=[A-Za-z0-9.+-]+)*;base64,([A-Za-z0-9+/=\\s]+)")

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
   by the first wrapped line, if any. A break wraps when the line before it is full width and the
   next character is in the base64 alphabet. **NB**: This means that when the last base64 line is
   itself full width (64 or 76 characters), and the next line starts with a base64 character,
   that line will be treated as more base64 data."
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

(defn- match-payload-start
  "Index in the searched text where the base64 payload of `match` begins."
  [match]
  (let [full (aget match 0)
        payload (or (aget match 2) "")]
    (+ (.-index match) (- (count full) (count payload)))))

(defn image-data-urls
  "Base64 image data URLs in `text`, as `{:start :end :mime :base64 :payload-start}`. The pattern
   finds where each one starts; `base64-payload-end` decides where it ends, and the search resumes
   there."
  [text]
  (let [re (js/RegExp. image-data-url-pattern "g")]
    (loop [found []]
      (if-let [match (.exec re text)]
        (let [mime (aget match 1)
              start (.-index match)
              payload-start (match-payload-start match)
              end (base64-payload-end text payload-start)]
          (set! (.-lastIndex re) end)
          (recur (cond-> found
                   (> end payload-start) (conj {:start start
                                                :end end
                                                :mime mime
                                                :payload-start payload-start
                                                :base64 (subs text payload-start end)}))))
        found))))

(def ^:private partial-header-pattern
  #"d(?:a(?:t(?:a(?::(?:i(?:m(?:a(?:g(?:e(?:/(?:[A-Za-z0-9.+-]*(?:;(?:[A-Za-z0-9.+-]+=[A-Za-z0-9.+-]+;)*(?:b(?:a(?:s(?:e(?:6(?:4,?)?)?)?)?)?|[A-Za-z0-9.+-]+=[A-Za-z0-9.+-]*|[A-Za-z0-9.+-]*))?)?)?)?)?)?)?)?)?)?)?)?$")

(defn- open-payload?
  "True when more base64 or padding appended to `text` would still belong to the payload at
   `payload-start`."
  [text payload-start]
  (some #(> (base64-payload-end (str text %) payload-start) (count text)) ["A" "="]))

(defn pending-start
  "Index in `text` where an image data URL starts that may continue in the next chunk of the same
   stream, or nil. That is the last data URL when its payload is still open at the end of `text`,
   or a trailing beginning of a data URL header."
  [text]
  (let [{:keys [start payload-start]} (peek (image-data-urls text))]
    (if (and start (open-payload? text payload-start))
      start
      (when-let [partial-header (re-find partial-header-pattern text)]
        (- (count text) (count partial-header))))))

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
          images (map-indexed (fn [i {:keys [mime base64 start payload-start]}]
                                {:image/n (inc i)
                                 :image/mime mime
                                 :image/subtype (subs mime (count "image/"))
                                 :image/size (format-byte-size (decoded-byte-count base64))
                                 :image/data-url (str (subs text start payload-start)
                                                      (str/replace base64 #"\s" ""))})
                              found)
          ends (cons 0 (map :end found))
          pieces (mapcat (fn [rest-start {:keys [start]} image]
                           [(subs text rest-start start) (placeholder image)])
                         ends found images)]
      {:text (apply str (concat pieces [(subs text (last ends))]))
       :images (vec images)})))

(defn- images-on-line
  [line images]
  (->> images
       (keep (fn [image]
               (when-let [idx (str/index-of line (placeholder image))]
                 [idx image])))
       (sort-by first)
       (mapv second)))

(defn- add-line-to-segments
  [{:keys [buf out]} line images]
  (let [on-line (images-on-line line images)]
    (if (seq on-line)
      {:buf []
       :out (conj out {:text (apply str (conj buf line))
                       :images on-line})}
      {:buf (conj buf line)
       :out out})))

(defn segments-with-images
  "Splits `text` after each line that holds image placeholders. Each segment is
   `{:text line-or-lines :images [...]}`: those images belong directly below that text.
   Images that never appear in `text` are a last segment with empty text."
  [text images]
  (let [lines (re-seq #"[^\r\n]*(?:\r\n|\n|\r)|[^\r\n]+$" (or text ""))
        {:keys [buf out]} (reduce (fn [state line]
                                    (add-line-to-segments state line images))
                                  {:buf [] :out []}
                                  lines)
        segments (cond-> out
                   (seq buf) (conj {:text (apply str buf) :images []}))
        used (into #{} (mapcat :images segments))
        leftover (into [] (remove used) images)]
    (cond-> segments
      (seq leftover) (conj {:text "" :images leftover}))))
