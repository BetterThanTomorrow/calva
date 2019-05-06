(ns calva.fmt.formatter
  (:require [cljfmt.core :as cljfmt]
            #_[zprint.core :refer [zprint-str]]
            ["paredit.js" :as paredit]
            [calva.js-utils :refer [cljify jsify]]
            [calva.fmt.util :as util]
            [clojure.string]))


(defn format-text
  [{:keys [range-text eol config] :as m}]
  (try
    (let [formatted-text (-> range-text
                             (cljfmt/reformat-string config)
                             (clojure.string/replace #"\r?\n" eol))]
      (assoc m :range-text formatted-text))
    (catch js/Error e
      (assoc m :error (.-message e)))))


(defn current-line-empty?
  "Figure out if `:current-line` is empty"
  [{:keys [current-line]}]
  (some? (re-find #"^\s*$" current-line)))


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


(defn enclosing-range
  "Expands the range from `idx` up to any enclosing list/vector/map/string"
  [{:keys [all-text idx] :as m}]
  (assoc m :range
         (let [ast (paredit/parse all-text)
               range ((.. paredit -navigator -sexpRange) ast idx)
               enclosing (try
                           (if (some? range)
                             (loop [range range]
                               (let [text (apply subs all-text range)]
                                 (if (and (some? range)
                                          (or (= idx (first range))
                                              (= idx (last range))
                                              (not (util/enclosing? text))))
                                   (let [expanded-range ((.. paredit -navigator -sexpRangeExpansion) ast (first range) (last range))]
                                     (if (and (some? expanded-range) (not= expanded-range range))
                                       (recur expanded-range)
                                       (cljify range)))
                                   (cljify range))))
                             [idx idx])
                           (catch js/Error e
                             ((.. paredit -navigator -rangeForDefun) ast idx)))]
           (loop [enclosing enclosing]
             (let [expanded-range ((.. paredit -navigator -sexpRangeExpansion) ast (first enclosing) (last enclosing))]
               (if (some? expanded-range)
                 (let [text (apply subs all-text expanded-range)]
                   (if (and (not= expanded-range enclosing) (re-find #"^['`#?_]" text))
                     (recur expanded-range)
                     (cljify enclosing)))
                 (cljify enclosing)))))))


(comment
  (enclosing-range {:all-text "  ([]\n[])"
                    :idx 6})
  (enclosing-range {:all-text "   (foo)"
                    :idx 4})
  (enclosing-range {:all-text "  \"(foo)\""
                    :idx 4})
  (enclosing-range {:all-text "  ((foo))"
                    :idx 4})
  (enclosing-range {:all-text "  (#{foo})"
                    :idx 5})
  (def s "(foo \"([\\[\\]\\])\")")
  (count s)
  (enclosing-range {:all-text s
                    :idx 4})
  (pr-str s)
  (def s " (\"([\\[\\]\\])\")")
  (cljfmt/reformat-string (pr-str s)
                          {:remove-surrounding-whitespace? false
                           :remove-trailing-whitespace? false
                           :remove-consecutive-blank-lines? false
                           :align-associative? true}))

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
  [{:keys [range-text range-tail on-type idx] :as m}]
  #_(if-not (= range-text "0")
      (assoc m :new-index idx))
  (let [leading-space-length (count (re-find #"^[ \t]*" range-tail))
        tail-pattern (-> range-tail
                         (util/escape-regexp)
                         (clojure.string/replace #"^[ \t]+" "")
                         (clojure.string/replace #"\s+" "\\s*"))
        tail-pattern (if (and on-type (re-find #"^\r?\n" range-tail))
                       (str "(\\r?\\n)+" tail-pattern)
                       tail-pattern)
        pos (util/re-pos-first (str "[ \\t]{0," leading-space-length "}" tail-pattern "$") range-text)]
    (assoc m :new-index pos)))


(defn format-text-at-range
  "Formats text from all-text at the range"
  [{:keys [all-text range idx config on-type] :as m}]
  (let [indent-before (indent-before-range m)
        padding (apply str (repeat indent-before " "))
        range-text (subs all-text (first range) (last range))
        padded-text (str padding range-text)
        range-index (- idx (first range))
        tail (subs range-text range-index)
        formatted-m (format-text (assoc m :range-text padded-text))]
    (-> (assoc m :range-text (subs (:range-text formatted-m) indent-before))
        (assoc :range-tail tail)
        (index-for-tail-in-range))))

(comment
  (format-text-at-range {:all-text "  '([]\n[])"
                         :idx 7
                         :on-type true
                         :head "  '([]\n"
                         :tail "[])"
                         :current-line "[])"
                         :range [4 9]}))


(defn add-indent-token-if-empty-current-line
  "If `:current-line` is empty add an indent token at `:idx`"
  [{:keys [head tail] :as m}]
  (let [indent-token "0"]
    (if (current-line-empty? m)
      (assoc m :all-text (str head indent-token tail))
      m)))


(defn remove-indent-token-if-empty-current-line
  "If an indent token was added, lets remove it. Not forgetting to shrink `:range`"
  [{:keys [range-text range new-index] :as m}]
  (if (current-line-empty? m)
    (assoc m :range-text (str (subs range-text 0 new-index) (subs range-text (inc new-index)))
           :range [(first range) (dec (second range))])
    m))


(defn format-text-at-idx
  "Formats the enclosing range of text surrounding idx"
  [{:keys [all-text idx] :as m}]
  (-> m
      (add-head-and-tail)
      (add-current-line)
      (add-indent-token-if-empty-current-line)
      (enclosing-range)
      (format-text-at-range)
      (remove-indent-token-if-empty-current-line)))


(defn format-text-at-idx-on-type
  "Relax formating some when used as an on-type handler"
  [m]
  (-> m
      (assoc :on-type true)
      (assoc-in [:config :remove-surrounding-whitespace?] false)
      (assoc-in [:config :remove-trailing-whitespace?] false)
      (assoc-in [:config :remove-consecutive-blank-lines?] false)
      (format-text-at-idx)))

(comment
  (:range-text (format-text-at-idx-on-type {:all-text "  '([]\n[])" :idx 7})))

