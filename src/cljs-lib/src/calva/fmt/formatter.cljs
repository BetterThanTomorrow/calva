(ns calva.fmt.formatter
  (:require [pez-cljfmt.core :as pez-cljfmt]
            [cljfmt.core :as cljfmt]
            #_[zprint.core :refer [zprint-str]]
            [calva.js-utils :refer [jsify cljify]]
            [calva.fmt.util :as util]
            [calva.parse :refer [parse-clj-edn]]
            [clojure.string]))

(defn- merge-default-indents
  "Merges onto default-indents.
   The :replace metadata hint allows to replace defaults."
  [indents]
  (if (:replace (meta indents))
    indents
    (merge cljfmt/default-indents indents)))

(def ^:private default-fmt
  {:remove-surrounding-whitespace? true
   :remove-trailing-whitespace? true
   :remove-consecutive-blank-lines? false
   :insert-missing-whitespace? true
   :align-associative? false})

(defn merge-cljfmt
  [fmt]
  (as-> fmt $
    (update $ :indents merge-default-indents)
    (merge default-fmt $)))

(defn- read-cljfmt
  [s]
  (try
    (as-> s $
      (parse-clj-edn $)
      (merge-cljfmt $))
    (catch js/Error e
      {:error (.-message e)})))

(defn- reformat-string [range-text {:keys [align-associative?
                                           remove-multiple-non-indenting-spaces?] :as config}]
  (let [cljfmt-options (:cljfmt-options config)
        trim-space-between? (or remove-multiple-non-indenting-spaces?
                                (:remove-multiple-non-indenting-spaces? cljfmt-options))]
    (if (or align-associative?
            (:align-associative? cljfmt-options))
      (pez-cljfmt/reformat-string range-text (-> cljfmt-options
                                                 (assoc :align-associative? true)
                                                 (dissoc :remove-multiple-non-indenting-spaces?)))
      (cljfmt/reformat-string range-text (-> cljfmt-options
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
                          :align-associative? true}}}))

(defn extract-range-text
  [{:keys [all-text range]}]
  (subs all-text (first range) (last range)))

(defn current-line-empty?
  "Figure out if `:current-line` is empty"
  [{:keys [current-line]}]
  (some? (re-find #"^[\s,]*$" current-line)))


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


(defn add-head-and-tail
  "Splits `:all-text` at `:idx` in `:head` and `:tail`"
  [{:keys [all-text idx] :as m}]
  (-> m
      (assoc :head (subs all-text 0 idx)
             :tail (subs all-text idx))))


(defn add-current-line
  "Finds the text of the current line in `text` from cursor position `index`"
  [{:keys [head tail] :as m}]
  (-> m
      (assoc :current-line
             (str (second (re-find #"\n?(.*)$" head))
                  (second (re-find #"^(.*)\n?" tail))))))


(defn- normalize-indents
  "Normalizes indents based on where the text starts on the first line"
  [{:keys [range-text eol] :as m}]
  (let [indent-before (apply str (repeat (indent-before-range m) " "))
        lines (clojure.string/split range-text #"\r?\n(?!\s*;)" -1)]
    (assoc m :range-text (clojure.string/join (str eol indent-before) lines))))


(defn index-for-tail-in-range
  "Find index for the `tail` in `text` disregarding whitespace"
  [{:keys [range-text range-tail on-type] :as m}]
  (let [leading-space-length (count (re-find #"^[ \t,]*" range-tail))
        space-sym (str "@" (gensym "ESPACEIALLY") "@")
        tail-pattern (-> range-tail
                         (clojure.string/replace #"[\]\)\}\"]" (str "$&" space-sym))
                         (util/escape-regexp)
                         (clojure.string/replace #"^[ \t,]+" "")
                         (clojure.string/replace #"[\s,]+" "[\\s,]*")
                         (clojure.string/replace space-sym " ?"))
        tail-pattern (if (and on-type (re-find #"^\r?\n" range-tail))
                       (str "(\\r?\\n)+" tail-pattern)
                       tail-pattern)
        pos (util/re-pos-first (str "[ \\t]{0," leading-space-length "}" tail-pattern "$") range-text)]
    (assoc m :new-index pos)))

(defn format-text-at-range
  "Formats text from all-text at the range"
  [{:keys [range idx] :as m}]
  (let [indent-before (indent-before-range m)
        padding (apply str (repeat indent-before " "))
        range-text (extract-range-text m)
        padded-text (str padding range-text)
        range-index (- idx (first range))
        tail (subs range-text range-index)
        formatted-m (format-text (assoc m :range-text padded-text))
        formatted-text (subs (:range-text formatted-m) indent-before)]
    (-> (assoc formatted-m
               :range-text formatted-text
               :range-tail tail))))

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


(defn add-indent-token-if-empty-current-line
  "If `:current-line` is empty add an indent token at `:idx`"
  [{:keys [head tail range] :as m}]
  (let [indent-token "0"
        new-range [(first range) (inc (last range))]]
    (if (current-line-empty? m)
      (let [m1 (assoc m
                      :all-text (str head indent-token tail)
                      :range new-range)]
        (assoc m1 :range-text (extract-range-text m1)))
      m)))


(defn remove-indent-token-if-empty-current-line
  "If an indent token was added, lets remove it. Not forgetting to shrink `:range`"
  [{:keys [range-text range new-index] :as m}]
  (if (current-line-empty? m)
    (assoc m :range-text (str (subs range-text 0 new-index) (subs range-text (inc new-index)))
           :range [(first range) (dec (second range))])
    m))

(def trailing-bracket_symbol "_calva-fmt-trail-symbol_")
(def trailing-bracket_pattern (re-pattern (str "_calva-fmt-trail-symbol_\\)$")))

(defn add-trail-symbol-if-comment
  "If the `range-text` is a comment, add a symbol at the end, preventing the last paren from folding"
  [{:keys [range all-text config idx] :as m}]
  (let [keep-trailing-bracket-on-own-line?
        (and (:keep-comment-forms-trail-paren-on-own-line? config)
             (:comment-form? config))]
    (if keep-trailing-bracket-on-own-line?
      (let [range-text (extract-range-text m)
            new-range-text (clojure.string/replace
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
  "If the `range-text` is a comment, remove the symbol at the end"
  [{:keys [range range-text new-index idx config] :as m} original-range]
  (let [keep-trailing-bracket-on-own-line?
        (and (:keep-comment-forms-trail-paren-on-own-line? config)
             (:comment-form? config))]
    (if keep-trailing-bracket-on-own-line?
      (let [new-range-text (clojure.string/replace
                            range-text
                            trailing-bracket_pattern
                            ")")]
        (-> m
            (assoc :range-text new-range-text
                   :new-index (if (>= idx (- (second range) 1))
                                (- (count new-range-text)
                                   (- (second range) idx))
                                new-index)
                   :range original-range)))
      m)))

(defn format-text-at-idx
  "Formats the enclosing range of text surrounding idx"
  [{:keys [range] :as m}]
  (-> m
      (update-in [:config :cljfmt-options] merge-cljfmt)
      (add-trail-symbol-if-comment)
      (add-head-and-tail)
      (add-current-line)
      (add-indent-token-if-empty-current-line)
      (format-text-at-range)
      (index-for-tail-in-range)
      (remove-indent-token-if-empty-current-line)
      (remove-trail-symbol-if-comment range)))

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

(defn format-text-bridge
  [^js m]
  (-> m
      (parse-cljfmt-options-string)
      (update-in [:config :cljfmt-options] merge-cljfmt)
      (format-text)))

(defn format-text-at-range-bridge
  [^js m]
  (-> m
      (parse-cljfmt-options-string)
      (update-in [:config :cljfmt-options] merge-cljfmt)
      (format-text-at-range)))

(defn format-text-at-idx-bridge
  [^js m]
  (-> m
      (parse-cljfmt-options-string)
      (format-text-at-idx)))

(defn format-text-at-idx-on-type-bridge
  [^js m]
  (-> m
      (parse-cljfmt-options-string)
      (format-text-at-idx-on-type)))

(defn merge-cljfmt-from-string-js-bridge
  [^js s]
  (-> s
      read-cljfmt
      jsify))

(defn merge-cljfmt-js-bridge
  [^js fmt]
  (-> fmt
      js-cljfmt-options->clj
      merge-cljfmt
      jsify))

(comment
  (:range-text (format-text-at-idx-on-type {:all-text "  '([]\n[])" :idx 7})))

(comment
  {:remove-surrounding-whitespace? false
   :remove-trailing-whitespace? false
   :remove-consecutive-blank-lines? false
   :insert-missing-whitespace? true
   :align-associative? true})
