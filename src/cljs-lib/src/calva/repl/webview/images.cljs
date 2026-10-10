(ns calva.repl.webview.images
  "Base64 image data URL detection for the output views. The pattern starts from Backseat Driver
   `reduce-images`, with the image subtype restricted to MIME token characters so a match cannot
   run across prose to a later `;base64,`. Optional `;name=value` MIME parameters (token characters
   only) may sit between the image type and `;base64`. Image URLs and file paths are added by
   `calva.repl.webview.image-refs` without replacing the source text."
  (:require
   [calva.repl.webview.image-refs :as image-refs]
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
  (if size
    (str "image-" n " " subtype " " size)
    (str "image-" n " " subtype)))

(defn placeholder
  [image]
  (str "<<" (label image) ">>"))

(defn- newline-at
  "Length of a newline at `i`, or 0."
  [text i]
  (cond
    (= "\n" (get text i)) 1
    (and (= "\r" (get text i)) (= "\n" (get text (inc i)))) 2
    (= "\r" (get text i)) 1
    :else 0))

(defn- line-pos-at
  "`[line-index line-offset]` for character index `abs` in `text`."
  [text abs]
  (loop [i 0 line 0 line-start 0]
    (if (>= i abs)
      [line (- abs line-start)]
      (let [nl (newline-at text i)]
        (if (pos? nl)
          (recur (+ i nl) (inc line) (+ i nl))
          (recur (inc i) line line-start))))))

(def max-result-data-url-payload-chars
  "Total compact base64 characters kept as data-URL images in one result. Same size as
   `image-refs/max-result-scan-chars`: bounds memory for data-URL payloads held on the image
   maps for one result."
  1048576)

(defonce !max-result-data-url-payload-chars (atom nil))

(defn- compact-base64
  [base64]
  (str/replace base64 #"\s" ""))

(defn- data-url-candidate
  [{:keys [mime base64 start end payload-start]}]
  {:cand/kind :data
   :cand/start start
   :cand/end end
   :cand/payload-start payload-start
   :cand/mime mime
   :cand/base64 base64
   :cand/payload-chars (count (compact-base64 base64))
   :cand/decoded-bytes (decoded-byte-count base64)})

(defn- ref-candidate
  [image]
  {:cand/kind :ref
   :cand/start (:image/start image)
   :cand/image image})

(defn- payload-char-limit
  []
  (or @!max-result-data-url-payload-chars max-result-data-url-payload-chars))

(defn- accept-data-cand?
  [payload {:cand/keys [payload-chars]}]
  (<= (+ payload payload-chars) (payload-char-limit)))

(defn- step-select-result-image
  [{:keys [accepted omitted payload] :as state} c]
  (cond
    (>= (count accepted) image-refs/max-result-image-refs)
    (reduced state)

    (and (= :data (:cand/kind c))
         (not (accept-data-cand? payload c)))
    (update state :omitted conj (dissoc c :cand/base64))

    (= :data (:cand/kind c))
    {:accepted (conj accepted c)
     :omitted omitted
     :payload (+ payload (:cand/payload-chars c))}

    :else
    {:accepted (conj accepted c)
     :omitted omitted
     :payload payload}))

(defn- select-result-image-cands
  "Keeps the first `max-result-image-refs` candidates in printed order. A data URL that would
   push the compact base64 total past the payload budget is returned in `:omitted` without its
   base64. Candidates past the count cap are dropped and stay as printed text."
  [data-found refs]
  (-> (reduce step-select-result-image
              {:accepted [] :omitted [] :payload 0}
              (->> (concat (map data-url-candidate data-found)
                           (map ref-candidate refs))
                   (sort-by :cand/start)))
      (select-keys [:accepted :omitted])))

(defn- advance-one
  [s abs-start {:keys [i line line-start]}]
  (let [nl (newline-at s i)]
    (if (pos? nl)
      {:i (+ i nl) :line (inc line) :line-start (+ abs-start i nl)}
      {:i (inc i) :line line :line-start line-start})))

(defn- advance-through
  "Line state after appending `s` that starts at absolute output index `abs-start`."
  [s abs-start line line-start]
  (let [n (count s)
        end (loop [state {:i 0 :line line :line-start line-start}]
              (if (>= (:i state) n)
                state
                (recur (advance-one s abs-start state))))]
    [(:line end) (:line-start end)]))

(defn- omitted-data-url-marker
  "Text that replaces a data URL the payload budget leaves out of the image form."
  [{:cand/keys [mime decoded-bytes]}]
  (str "<<image " (subs mime (count "image/")) " " (format-byte-size decoded-bytes) ">>"))

(defn- data-image-from-cand
  [text {:cand/keys [n mime base64 payload-start start]}]
  {:image/n n
   :image/mime mime
   :image/subtype (subs mime (count "image/"))
   :image/size (format-byte-size (decoded-byte-count base64))
   :image/data-url (str (subs text start payload-start) (compact-base64 base64))})

(defn- data-cand-replacement
  "Replacement text for one data-URL candidate, and the image when the candidate is kept."
  [text {:cand/keys [start end] :as c} line line-offset]
  (let [omitted? (:cand/omitted c)
        image (when-not omitted?
                (assoc (data-image-from-cand text c)
                       :image/line-index line
                       :image/line-offset line-offset))
        replacement (if omitted?
                      (omitted-data-url-marker c)
                      (placeholder image))]
    {:replacement replacement
     :image image
     :shift [start (- (count replacement) (- end start))]}))

(defn- rebuild-with-data-urls
  "Replaces each accepted data URL with its placeholder and each omitted data URL with a short
   marker. Records line positions while building. An omitted data URL adds no image."
  [text data-cands]
  (loop [pos 0
         remaining data-cands
         pieces []
         images []
         shifts []
         out-len 0
         line 0
         line-start 0]
    (if-let [c (first remaining)]
      (let [{:cand/keys [start end]} c
            chunk (subs text pos start)
            [line' line-start'] (advance-through chunk out-len line line-start)
            out-at-ph (+ out-len (count chunk))
            {:keys [replacement image shift]} (data-cand-replacement text
                                                                     c
                                                                     line'
                                                                     (- out-at-ph line-start'))]
        (recur end
               (rest remaining)
               (conj pieces chunk replacement)
               (cond-> images
                 image (conj image))
               (conj shifts shift)
               (+ out-at-ph (count replacement))
               line'
               line-start'))
      {:text (apply str (conj pieces (subs text pos)))
       :images images
       :shift-events shifts})))

(defn- shift-abs
  [orig-start shift-events]
  (reduce (fn [abs [start delta]]
            (if (< start orig-start)
              (+ abs delta)
              abs))
          orig-start
          shift-events))

(defn- ref-image-from-cand
  [new-text shift-events {:cand/keys [n image start]}]
  (let [abs' (shift-abs start shift-events)
        [line-idx line-offset] (line-pos-at new-text abs')]
    (-> image
        (assoc :image/n n
               :image/line-index line-idx
               :image/line-offset line-offset)
        (dissoc :image/start))))

(defn extract-images
  "Replaces accepted base64 image data URLs in `text` with `<<image-N TYPE SIZE>>`, numbered
   from 1 in printed order with path and URL refs. A data URL past the payload budget is
   replaced with `<<image TYPE SIZE>>` and left out of `:images`. Data URLs past the shared
   count cap stay as printed text. Image URLs and file paths are left in the text.
   Returns `{:text ... :images [image ...]}`."
  [text]
  (if-not (string? text)
    {:text text :images []}
    (let [data-found (if (str/includes? text "data:image/")
                       (image-data-urls text)
                       [])
          refs (image-refs/result-image-refs text)
          {:keys [accepted omitted]} (select-result-image-cands data-found refs)
          selected (->> accepted
                        (sort-by :cand/start)
                        (map-indexed (fn [i c] (assoc c :cand/n (inc i))))
                        vec)
          data-cands (->> (concat (filterv #(= :data (:cand/kind %)) selected)
                                  (mapv #(assoc % :cand/omitted true) omitted))
                          (sort-by :cand/start)
                          vec)
          ref-cands (filterv #(= :ref (:cand/kind %)) selected)
          {:keys [text images shift-events]} (rebuild-with-data-urls text data-cands)
          ref-images (mapv #(ref-image-from-cand text shift-events %) ref-cands)]
      {:text text
       :images (->> (concat images ref-images)
                    (sort-by (juxt :image/line-index :image/line-offset))
                    vec)})))

(defn- source-of
  [image]
  (or (:image/source image) (placeholder image)))

(defn- images-on-line
  "Images that belong under this line, ordered by position in the line.
   Indexed images use `:image/line-offset`; unindexed ones match their source text."
  [line-idx line by-line unindexed]
  (let [from-indexed (map (fn [image]
                            [(:image/line-offset image) image])
                          (get by-line line-idx []))
        from-unindexed (keep (fn [image]
                               (when-let [idx (str/index-of line (source-of image))]
                                 [idx image]))
                             unindexed)]
    (->> (concat from-indexed from-unindexed)
         (sort-by first)
         (mapv second))))

(defn- add-line-to-segments
  [{:keys [buf out line-idx]} line by-line unindexed]
  (let [on-line (images-on-line line-idx line by-line unindexed)]
    (if (seq on-line)
      {:buf []
       :out (conj out {:text (apply str (conj buf line))
                       :images on-line})
       :line-idx (inc line-idx)}
      {:buf (conj buf line)
       :out out
       :line-idx (inc line-idx)})))

(defn segments-with-images
  "Splits `text` after each line that holds image placeholders or refs. Each segment is
   `{:text line-or-lines :images [...]}`: those images belong directly below that text.
   Images that never appear in `text` are a last segment with empty text."
  [text images]
  (let [by-line (group-by :image/line-index (filter #(contains? % :image/line-index) images))
        unindexed (into [] (remove #(contains? % :image/line-index) images))
        lines (re-seq #"[^\r\n]*(?:\r\n|\n|\r)|[^\r\n]+$" (or text ""))
        {:keys [buf out]} (reduce (fn [state line]
                                    (add-line-to-segments state line by-line unindexed))
                                  {:buf [] :out [] :line-idx 0}
                                  lines)
        segments (cond-> out
                   (seq buf) (conj {:text (apply str buf) :images []}))
        used (into #{} (mapcat :images segments))
        leftover (into [] (remove used) images)]
    (cond-> segments
      (seq leftover) (conj {:text "" :images leftover}))))
