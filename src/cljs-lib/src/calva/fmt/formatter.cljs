(ns calva.fmt.formatter
  (:require [pez-cljfmt.core :as pez-cljfmt]
            [cljfmt.core :as cljfmt]
            #_[zprint.core :refer [zprint-str]]
            [calva.js-utils :refer [jsify cljify]]
            [calva.fmt.util :as util]
            [calva.parse :refer [parse-clj-edn]]
            [clojure.string]))

(def ^:private default-fmt
  {:remove-surrounding-whitespace? true
   :remove-trailing-whitespace? true
   :remove-consecutive-blank-lines? false
   :insert-missing-whitespace? true
   :indent-line-comments? true
   :align-associative? false})

(defn merge-default-config
  [fmt]
  (as-> fmt $
    (merge default-fmt $)))

(defn- convert-legacy-keys [config]
  (cond-> config
    (:legacy/merge-indents? config)
    (-> (assoc :extra-indents (:indents config))
        (dissoc :indents))))

(defn- convert-to-old-config [config]
  (let [new-config (convert-legacy-keys config)]
    (if (:extra-indents new-config)
      (-> new-config
          (assoc :indents (:extra-indents new-config))
          (assoc :indents (merge cljfmt/default-indents (:extra-indents new-config))))
      new-config)))

(defn- read-cljfmt
  [s]
  (try
    (-> s
        parse-clj-edn
        convert-legacy-keys)
    (catch js/Error e
      (merge default-fmt
             {:error (.-message e)
              :indents cljfmt/default-indents}))))

(defn- reformat-string [range-text {:keys [align-associative?
                                           remove-multiple-non-indenting-spaces?] :as config}]
  (let [cljfmt-options (:cljfmt-options config)
        trim-space-between? (or remove-multiple-non-indenting-spaces?
                                (:remove-multiple-non-indenting-spaces? cljfmt-options))]
    (if (or align-associative?
            (:align-associative? cljfmt-options))
      (pez-cljfmt/reformat-string range-text (-> cljfmt-options
                                                 convert-to-old-config
                                                 (assoc :align-associative? true)
                                                 (dissoc :remove-multiple-non-indenting-spaces?)))
      (cljfmt/reformat-string range-text (-> cljfmt-options
                                             convert-legacy-keys
                                             (assoc :remove-multiple-non-indenting-spaces?
                                                    trim-space-between?))))))

(defn format-text
  [{:keys [range-text eol config] :as m}]
  (try
    (let [formatted-text (-> range-text
                             (reformat-string config)
                             (clojure.string/replace #"\r?\n" eol))]
      (assoc m :range-text formatted-text))
    (catch js/Error e
      (assoc m :error (.-message e)))))

(comment
  {:eol "\n" :all-text "[:foo\n\n(foo)(bar)]" :idx 6}
  (def s "[:foo\n\n(foo\n(bar))]")
  #_(def s "(defn\n0\n#_)")
  (format-text #_s
   {:range-text s
    :eol "\n"
    :config {:cljfmt-options
             {:remove-surrounding-whitespace? false
              :indents {"foo" [["inner" 0]]}
              :remove-trailing-whitespace? false
              :remove-consecutive-blank-lines? false
              :align-associative? true}}})

  (format-text
   {:range-text "^[Long] foo"})

  (format-text
   {:range-text "^Long/1 foo"}))

(defn extract-range-text
  [{:keys [all-text range]}]
  (subs all-text (first range) (last range)))

(defn string-clojure-blank?
  "Whether s contains nothing other than Clojure whitespace (including commas)"
  [s]
  (some? (re-find #"^[\s,]*$" s)))

(defn indent-before-range
  "Figures out how much extra indentation to add based on the length of the line before the range"
  [{:keys [all-text range]}]
  (let [start (first range)
        end (last range)]
    (if (= start end)
      0
      (-> (subs all-text 0 (first range))
          (util/split-into-lines)
          (last)
          (count)))))

(defn generate-marker!
  "Lexically plausible, space-free s-expr that does not appear in s"
  [s]
  (first
   (drop-while
    #(clojure.string/includes? s %)
    (repeatedly #(str (gensym "@MARKER"))))))

(defn line-about-idx
  "[start index inclusive, end index exclusive] of the line of text
   whose first character is at-or-before idx."
  [s idx]
  (let [a (if (zero? idx)
            0
            (let [i (.lastIndexOf s "\n" (dec idx))]
              (if (= -1 i)
                0
                (inc i))))
        b (let [i (.indexOf s "\n" idx)]
            (if (= -1 i)
              (.-length s)
              i))]
    [a b]))

;; insert tokens end-to-start to avoid the need to update idxs.
;; idxs are relative to all-text, not range-text.
;; work with the range in a loop, then substitute modified range back into all-text.
(defn add-indent-token-to-blank-idx-lines
  "m unmodified unless it needed tokens inserted, in which case
 with additional key :indent-token, and updated :all-text and :range
 reflecting growth or shrinkage due to indent-tokens replacing blanks.
 (Indent-tokens are placed AFTER the blanks on a blank line
 because those blanks, if inside a string, are significant
 and we must not delete them. However, if the blank line isn't in a string,
 this may prevent the formatter from curing excessive indentation.)
 DOES NOT update :idxs to reflect insertion of indent tokens."
  [{[a b :as _range] :range :keys [all-text idxs] :as m}]
  (let [range-text (subs all-text a b)
        marker (delay (generate-marker! range-text))
        idxs-in-range (into []
                            (comp
                             (remove #(< % a))
                             (remove #(>= % b)))
                            idxs)
        range-text' (reduce
                     (fn [erg idx]
                       (let [range-idx (- idx a)
                             [line-start line-end] (line-about-idx erg range-idx)
                             line (subs erg line-start line-end)]
                         (if (string-clojure-blank? line)
                           (str (subs erg 0 line-end) @marker (subs erg line-end))
                           erg)))
                     range-text
                     (sort > idxs-in-range))
        range' [a (+ a (.-length range-text'))]]
    (if (= range-text range-text')
      m
      (let [all-text' (str (subs all-text 0 a) range-text' (subs all-text b))]
        (-> m
            (assoc :indent-token @marker
                   :all-text all-text'
                   :range range'))))))

(defn remove-indent-tokens
  "m unmodified if there is no indent-token, otherwise with
 range-text and range adjusted by removal of
 indent-tokens"
  [{:keys [range-text indent-token] :as m}]
  (if-not indent-token
    m
    (let [range-text' (clojure.string/replace range-text indent-token "")]
      (-> m
          (assoc :range-text range-text')
          (dissoc :indent-token
          :range)))))

(defn format-text-at-range
  "m with formatted :range-text, and :all-text removed"
  [m]
  (let [indent-before (indent-before-range m)
        padding (apply str (repeat indent-before " "))
        range-text (extract-range-text m)
        padded-text (str padding range-text)
        formatted-m (format-text (assoc m :range-text padded-text))
        formatted-text (subs (:range-text formatted-m) indent-before)]
    (-> (assoc formatted-m
               :range-text formatted-text)
        (dissoc :all-text))))

(comment
  (format-text-at-range {:all-text "  '([]\n[])"
                         :idx 7
                         :on-type true
                         :head "  '([]\n"
                         :tail "[])"
                         :current-line "[])"
                         :range [4 9]})
  (format-text-at-range {:eol "\n"
                         :all-text "[:foo\n\n(foo)(bar)]"
                         :idx 6
                         :range [0 18]}))

(def trailing-bracket_symbol "_calva-fmt-trail-symbol_")
(def trailing-bracket_pattern (re-pattern (str "_calva-fmt-trail-symbol_\\)$")))
(def rich-comment-keyword :rcf)
(def trailing-rcf-marker-pattern (re-pattern (str "(" rich-comment-keyword "|#_\\S+)\\s*\\)$")))

(defn add-trail-symbol-if-comment
  "If the `range-text` is a comment, add a symbol at the end, preventing the last paren from folding"
  [{:keys [range all-text config idx] :as m}]
  (let [range-text (extract-range-text m)
        keep-trailing-bracket-on-own-line?
        (and (:keep-comment-forms-trail-paren-on-own-line? config)
             (:comment-form? config)
             (not (re-find trailing-rcf-marker-pattern range-text)))]
    (if keep-trailing-bracket-on-own-line?
      (let [new-range-text (clojure.string/replace
                            range-text
                            #"\n{0,1}[ \t,]*\)$"
                            (str "\n" trailing-bracket_symbol ")"))
            added-text-length (- (count new-range-text)
                                 (count range-text))
            new-range-end (+ (second range) added-text-length)
            new-all-text (str (subs all-text 0 (first range))
                              new-range-text
                              (subs all-text (second range)))
            new-idx (if (>= idx (- (second range) 1))
                      (+ idx added-text-length)
                      idx)]
        (-> m
            (assoc :all-text new-all-text
                   :range-text new-range-text
                   :idx new-idx)
            (assoc-in [:range 1] new-range-end)))
      m)))

(defn remove-trail-symbol-if-comment
  "m with updated :range and :range-text reflecting removal of comment prop"
  [{:keys [range-text config] :as m}]
  (let [keep-trailing-bracket-on-own-line?
        (and (:keep-comment-forms-trail-paren-on-own-line? config)
             (:comment-form? config))]
    (if keep-trailing-bracket-on-own-line?
      (let [new-range-text (clojure.string/replace
                            range-text
                            trailing-bracket_pattern
                            ")")]
        (-> m
            (assoc :range-text new-range-text)))
      m)))

(defn format-text-at-idx
  "Formats the range, preserving and creating indentation
  for blank lines at cursor offsets in :idxs"
  [{:keys [range] :as m}]
  (-> m
      (add-trail-symbol-if-comment)
      (add-indent-token-to-blank-idx-lines)
      (format-text-at-range)
      (remove-indent-tokens)
      (remove-trail-symbol-if-comment)
      (assoc :range range)))

(comment

  :rcf)
(defn format-text-at-idx-on-type
  "Relax formating some when used as an on-type handler"
  [m]
  (-> m
      (assoc :on-type true)
      (assoc-in [:config :cljfmt-options :remove-surrounding-whitespace?] false)
      (assoc-in [:config :cljfmt-options :remove-trailing-whitespace?] false)
      (assoc-in [:config :cljfmt-options :remove-consecutive-blank-lines?] false)
      (format-text-at-idx)))

(defn- js-cljfmt-options->clj [^js opts]
  (let [indents (.-indents opts)]
    (-> opts
        (cljify)
        (assoc :indents (->> indents
                             js->clj
                             (reduce-kv (fn [m k v]
                                          (let [new-v (reduce (fn [acc x]
                                                                (conj acc [(keyword (first x)) (second x)]))
                                                              []
                                                              v)]
                                            (if (.startsWith k "#")
                                              (let [regex-string (subs k 2 (- (count k) 1))]
                                                (assoc m (re-pattern regex-string) new-v))
                                              (assoc m (symbol k) new-v))))
                                        {}))))))

(defn- parse-cljfmt-options-string [^js m]
  (let [conf (.-config m)
        edn (aget conf "cljfmt-options-string")]
    (-> m
        (cljify)
        (assoc-in [:config :cljfmt-options] (parse-clj-edn edn)))))

(defn ^:export format-text-bridge
  [^js m]
  (-> m
      (parse-cljfmt-options-string)
      (format-text)))

(defn ^:export format-text-at-range-bridge
  [^js m]
  (-> m
      (parse-cljfmt-options-string)
      (format-text-at-range)))

(defn ^:export format-text-at-idx-bridge
  [^js m]
  (-> m
      (parse-cljfmt-options-string)
      (format-text-at-idx)))

(defn ^:export format-text-at-idx-on-type-bridge
  [^js m]
  (-> m
      (parse-cljfmt-options-string)
      (format-text-at-idx-on-type)))

(defn ^:export cljfmt-from-string-js-bridge
  [^js s]
  (-> s
      read-cljfmt
      jsify))

(defn ^:export get-default-indents-js-bridge
  []
  (jsify cljfmt/default-indents))

(comment
  (:range-text (format-text-at-idx-on-type {:all-text "  '([]\n[])" :idx 7})))

(comment
  {:remove-surrounding-whitespace? false
   :remove-trailing-whitespace? false
   :remove-consecutive-blank-lines? false
   :insert-missing-whitespace? true
   :align-associative? true})
