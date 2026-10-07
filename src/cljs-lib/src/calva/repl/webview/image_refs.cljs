(ns calva.repl.webview.image-refs
  "Image URLs and file paths in output. Stdout and stderr match a whole line (whitespace trimmed),
   or the contents of a Clojure-printed string that is the whole line. Mentions inside a longer
   line do not count. Evaluation results also match every printed string whose whole contents are
   an image URL, file URI, or image path. Data URLs stay in calva.repl.webview.images.

   Path rule: an absolute path (POSIX / or a Windows drive letter) and a file:/// URI may
   contain spaces; a relative path may not contain whitespace; ~ is not expanded."
  (:require
   [cljs.reader :as reader]
   [clojure.string :as str]))

(def image-subtypes
  {"png" "png"
   "jpg" "jpeg"
   "jpeg" "jpeg"
   "gif" "gif"
   "svg" "svg+xml"
   "webp" "webp"})

(def image-ext-pattern
  #"(?i)\.(png|jpe?g|gif|svg|webp)$")

(def url-image-ext-pattern
  #"(?i)\.(png|jpe?g|gif|svg|webp)(?:[?#]|$)")

(defn mime-for-subtype
  [subtype]
  (str "image/" subtype))

(defn- subtype-from-ext
  [ext]
  (get image-subtypes (str/lower-case ext)))

(defn- path-subtype
  [s]
  (when-let [[_ ext] (re-find image-ext-pattern s)]
    (subtype-from-ext ext)))

(defn- url-path
  "The URL path, without query or fragment."
  [s]
  (let [after-host (or (second (re-find #"^https?://[^/?#]+([^?#]*)" s))
                       (second (re-find #"^file://[^/?#]*([^?#]*)" s)))]
    after-host))

(defn- url-subtype
  [s]
  (when-let [path (url-path s)]
    (when-let [[_ ext] (re-find url-image-ext-pattern path)]
      (subtype-from-ext ext))))

(defn http-image-url?
  [s]
  (boolean (and (re-matches #"^https?://\S+$" s)
                (url-subtype s))))

(defn file-image-uri?
  "True when `s` is a `file:///` URI (empty authority) whose path ends in an image extension.
   Spaces in the path are allowed."
  [s]
  (boolean (and (str/starts-with? s "file:///")
                (url-subtype s))))

(defn- absolute-file-path?
  [s]
  (boolean (or (str/starts-with? s "/")
               (re-matches #"[A-Za-z]:[\\/].*" s))))

(defn image-file-path?
  "True when `s` is an image file path. Absolute paths (POSIX `/` or a Windows drive letter) may
   contain spaces; a relative path may not contain whitespace. `~` is not expanded."
  [s]
  (boolean (and (pos? (count s))
                (not (str/includes? s "://"))
                (path-subtype s)
                (or (absolute-file-path? s)
                    (not (re-find #"\s" s))))))

(defn unwrap-printed-string
  "Contents of a Clojure-printed string, or nil. The line must be exactly one string form."
  [s]
  (when (and (>= (count s) 2)
             (str/starts-with? s "\"")
             (str/ends-with? s "\""))
    (try
      (let [v (reader/read-string s)]
        (when (and (string? v) (= s (pr-str v))) v))
      (catch :default _ nil))))

(defn- ref-kind
  [token]
  (cond
    (http-image-url? token) :remote
    (file-image-uri? token) :local
    (image-file-path? token) :local
    :else nil))

(defn- subtype-of
  [token kind]
  (if (= :remote kind)
    (url-subtype token)
    (or (url-subtype token) (path-subtype token))))

(defn image-ref
  "An image map when `token` is a whole-line URL or path, otherwise nil."
  [token]
  (when-let [kind (ref-kind token)]
    (let [subtype (subtype-of token kind)]
      {:image/kind kind
       :image/src token
       :image/source token
       :image/mime (mime-for-subtype subtype)
       :image/subtype subtype})))

(defn- line-token
  "The candidate token on one output line: trimmed line, or printed-string contents."
  [line]
  (let [trimmed (str/trim (str/replace line #"[\r\n]+$" ""))]
    (or (unwrap-printed-string trimmed) trimmed)))

(defn image-refs
  "Whole-line image URL and path refs in `text`, as image maps with `:image/kind` `:remote` or
   `:local` and `:image/line-index` (0-based line in `text`). Does not replace the source text."
  [text]
  (if-not (string? text)
    []
    (->> (re-seq #"[^\r\n]*(?:\r\n|\n|\r)|[^\r\n]+$" text)
         (map-indexed (fn [idx line]
                        (when-let [image (image-ref (line-token line))]
                          (assoc image :image/line-index idx))))
         (keep identity)
         vec)))

(defn- next-in-string
  "Next index inside a string at `i`, `:closed` at the closing quote, or nil if truncated."
  [text i]
  (let [c (get text i)]
    (cond
      (nil? c) nil
      (= "\\" c) (when (get text (inc i)) (+ i 2))
      (= "\"" c) :closed
      :else (inc i))))

(defn- string-literal-end*
  [text i]
  (let [n (next-in-string text i)]
    (cond
      (nil? n) nil
      (= :closed n) (inc i)
      :else (recur text n))))

(defn- string-literal-end
  "Index after the closing quote of the string starting at `start`, or nil."
  [text start]
  (when (= "\"" (get text start))
    (string-literal-end* text (inc start))))

(defn- newline-length-at
  "Length of a newline starting at `i`, or 0."
  [text i]
  (let [c (get text i)]
    (cond
      (= "\n" c) 1
      (and (= "\r" c) (= "\n" (get text (inc i)))) 2
      (= "\r" c) 1
      :else 0)))

(defn- step-line-index
  [text n j]
  (let [nl (newline-length-at text j)]
    (if (pos? nl)
      [(inc n) (+ j nl)]
      [n (inc j)])))

(defn- line-index-at
  [text i]
  (loop [n 0 j 0]
    (if (>= j i)
      n
      (let [[n' j'] (step-line-index text n j)]
        (recur n' j')))))

(defn- image-ref-at-printed-string
  [text start end]
  (when-let [contents (unwrap-printed-string (subs text start end))]
    (when-let [image (image-ref contents)]
      (assoc image :image/line-index (line-index-at text start)))))

(defn- conj-printed-string-ref
  [found text start end]
  (if-let [image (image-ref-at-printed-string text start end)]
    (conj found image)
    found))

(defn- advance-printed-string-scan
  [text q found]
  (if-let [end (string-literal-end text q)]
    [end (conj-printed-string-ref found text q end)]
    [(inc q) found]))

(defn- scan-printed-string-refs
  [text]
  (loop [i 0 found []]
    (if-let [q (str/index-of text "\"" i)]
      (let [[ni found'] (advance-printed-string-scan text q found)]
        (recur ni found'))
      found)))

(defn- printed-string-image-refs
  "Image refs from Clojure-printed string literals in `text`, in appearance order."
  [text]
  (if (string? text)
    (scan-printed-string-refs text)
    []))

(defn result-image-refs
  "Image refs for an evaluation result: every matching printed string, plus whole-line refs that
   are not already covered by a string on that line. Appearance order."
  [text]
  (let [from-strings (printed-string-image-refs text)
        seen (into #{} (map (juxt :image/src :image/line-index) from-strings))
        from-lines (->> (image-refs text)
                        (remove (fn [img]
                                  (contains? seen [(:image/src img) (:image/line-index img)]))))]
    (->> (concat from-strings from-lines)
         (sort-by :image/line-index)
         vec)))
