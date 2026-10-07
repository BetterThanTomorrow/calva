(ns calva.repl.webview.image-refs
  "Image URLs and file paths in output. Stdout and stderr match a whole line (whitespace trimmed),
   or the contents of a Clojure-printed string that is the whole line. Mentions inside a longer
   line do not count. Evaluation results also match every printed string whose whole contents are
   an image URL or image file path. Data URLs stay in `calva.repl.webview.images`.

   Path rule: an absolute path (POSIX `/` or a Windows drive letter) and a `file:///` URI may
   contain spaces; a relative path may not contain whitespace; `~` is not expanded."
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
  "Image URLs and image file paths that fill a whole line of `text`, as image maps with `:image/kind`
   `:remote` or `:local` and `:image/line-index` (0-based line in `text`). Does not replace the source
   text."
  [text]
  (if-not (string? text)
    []
    (->> (re-seq #"[^\r\n]*(?:\r\n|\n|\r)|[^\r\n]+$" text)
         (map-indexed (fn [idx line]
                        (when-let [image (image-ref (line-token line))]
                          (assoc image :image/line-index idx))))
         (keep identity)
         vec)))

(def max-result-image-refs
  "Most image refs kept for one evaluation result."
  50)

(def max-result-scan-chars
  "Above this printed-result length, skip the per-string scan."
  1048576)

(defn- cap-result-image-refs
  [images]
  (vec (take max-result-image-refs images)))

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

(defn- line-index-from
  "Line index of character position `to`, counting forward from line `line` at position `from`."
  [text from to line]
  (loop [n line j from]
    (if (>= j to)
      n
      (let [[n' j'] (step-line-index text n j)]
        (recur n' j')))))

(defn- quote-after-backslash?
  "True when the quote at `q` is preceded by a backslash (printed char literal)."
  [text q]
  (and (pos? q)
       (= "\\" (get text (dec q)))))

(defn- hash-prefixed-string-quote?
  "True when the quote at `q` follows # (a printed regex)."
  [text q]
  (and (pos? q)
       (= "#" (get text (dec q)))))

(defn- image-ref-at-printed-string
  [text start end line]
  (when-let [contents (unwrap-printed-string (subs text start end))]
    (when-let [image (image-ref contents)]
      (assoc image :image/line-index line))))

(defn- conj-printed-string-ref
  [found text start end line]
  (if-let [image (image-ref-at-printed-string text start end line)]
    (conj found image)
    found))

(defn- consume-printed-string
  "Advance past the string at `q`; optionally keep an image ref. Returns `[next-index line found]`."
  [text q line found keep?]
  (if-let [end (string-literal-end text q)]
    [end
     (line-index-from text q end line)
     (if keep?
       (conj-printed-string-ref found text q end line)
       found)]
    [(inc q) line found]))

(defn- scan-next-quote
  "`[next-index line found]` after the next quote at or after `i`, or nil."
  [text i line found]
  (when-let [q (str/index-of text "\"" i)]
    (let [line-at-q (line-index-from text i q line)]
      (cond
        (quote-after-backslash? text q)
        [(inc q) line-at-q found]

        (hash-prefixed-string-quote? text q)
        (consume-printed-string text q line-at-q found false)

        :else
        (consume-printed-string text q line-at-q found true)))))

(defn- scan-printed-string-refs
  [text]
  (loop [i 0 line 0 found []]
    (if (>= (count found) max-result-image-refs)
      found
      (if-let [[next-index line' found'] (scan-next-quote text i line found)]
        (recur next-index line' found')
        found))))

(defn- printed-string-image-refs
  "Image refs from Clojure-printed string literals in `text`, in appearance order."
  [text]
  (if (string? text)
    (scan-printed-string-refs text)
    []))

(defn result-image-refs
  "Image refs for an evaluation result: every matching printed string, plus whole-line refs that
   are not already covered by a string on that line. Appearance order. At most `max-result-image-refs`.
   Above `max-result-scan-chars`, only whole-line refs."
  [text]
  (if-not (string? text)
    []
    (if (> (count text) max-result-scan-chars)
      (cap-result-image-refs (image-refs text))
      (let [from-strings (printed-string-image-refs text)
            seen (into #{} (map (juxt :image/src :image/line-index) from-strings))
            from-lines (->> (image-refs text)
                            (remove (fn [img]
                                      (contains? seen [(:image/src img) (:image/line-index img)]))))]
        (->> (concat from-strings from-lines)
             (sort-by :image/line-index)
             cap-result-image-refs)))))
