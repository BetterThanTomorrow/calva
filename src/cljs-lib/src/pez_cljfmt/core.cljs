(ns pez-cljfmt.core
  (:require [cljs.reader :as reader]
            [clojure.zip :as zip]
            [clojure.string :as str]
            [pez-rewrite-clj.node :as n]
            [pez-rewrite-clj.parser :as p]
            [pez-rewrite-clj.zip :as z]
            [pez-rewrite-clj.zip.base :as zb :refer [edn]]
            [pez-rewrite-clj.zip.whitespace :as zw
             :refer [append-space skip whitespace-or-comment?]])
  (:require-macros [pez-cljfmt.core :refer [read-resource]]))

(def zwhitespace?
  zw/whitespace?)

(def zlinebreak?
  zw/linebreak?)

(def includes?
  str/includes?)

(defn- find-all [zloc p?]
  (loop [matches []
         zloc zloc]
    (if-let [zloc (z/find-next zloc zip/next p?)]
      (recur (conj matches zloc)
             (zip/next zloc))
      matches)))

(defn- edit-all [zloc p? f]
  (loop [zloc (if (p? zloc) (f zloc) zloc)]
    (if-let [zloc (z/find-next zloc zip/next p?)]
      (recur (f zloc))
      zloc)))

(defn- transform [form zf & args]
  (z/root (apply zf (edn form) args)))

(defn- surrounding? [zloc p?]
  (and (p? zloc) (or (nil? (zip/left zloc))
                     (nil? (skip zip/right p? zloc)))))

(defn- top? [zloc]
  (and zloc (not= (z/node zloc) (z/root zloc))))

(defn- surrounding-whitespace? [zloc]
  (and (top? (z/up zloc))
       (surrounding? zloc zwhitespace?)))

(defn remove-surrounding-whitespace [form]
  (transform form edit-all surrounding-whitespace? zip/remove))

(defn- element? [zloc]
  (and zloc (not (whitespace-or-comment? zloc))))

(defn- reader-macro? [zloc]
  (and zloc (= (n/tag (z/node zloc)) :reader-macro)))

(defn- missing-whitespace? [zloc]
  (and (element? zloc)
       (not (reader-macro? (zip/up zloc)))
       (element? (zip/right zloc))))

(defn insert-missing-whitespace [form]
  (transform form edit-all missing-whitespace? append-space))

(defn- whitespace? [zloc]
  (= (z/tag zloc) :whitespace))

(defn- comma? [zloc]
  (= (z/tag zloc) :comma))

(defn- comment? [zloc]
  (some-> zloc z/node n/comment?))

(defn- line-break? [zloc]
  (or (zlinebreak? zloc) (comment? zloc)))

(defn- skip-whitespace [zloc]
  (skip zip/next whitespace? zloc))

(defn- skip-comma [zloc]
  (skip zip/next comma? zloc))

(defn- count-newlines [zloc]
  (loop [zloc zloc, newlines 0]
    (if (zlinebreak? zloc)
      (recur (-> zloc zip/right skip-whitespace)
             (-> zloc z/string count (+ newlines)))
      newlines)))

(defn- final-transform-element? [zloc]
  (= (z/next zloc) zloc))

(defn- consecutive-blank-line? [zloc]
  (and (> (count-newlines zloc) 2)
       (not (final-transform-element? zloc))))

(defn- remove-whitespace-and-newlines [zloc]
  (if (zwhitespace? zloc)
    (recur (zip/remove zloc))
    zloc))

(defn- replace-consecutive-blank-lines [zloc]
  (-> zloc
      z/next
      zip/prev
      remove-whitespace-and-newlines
      z/next
      (zip/insert-left (n/newlines 2))))

(defn remove-consecutive-blank-lines [form]
  (transform form edit-all consecutive-blank-line? replace-consecutive-blank-lines))

(defn- indentation? [zloc]
  (and (line-break? (zip/prev zloc)) (whitespace? zloc)))

(defn- comment-next? [zloc]
  (-> zloc zip/next skip-whitespace comment?))

(defn- should-indent? [zloc]
  (and (line-break? zloc) (not (comment-next? zloc))))

(defn- should-unindent? [zloc]
  (and (indentation? zloc) (not (comment-next? zloc))))

(defn unindent [form]
  (transform form edit-all should-unindent? zip/remove))

(def ^:private start-element
  {:meta "^", :meta* "#^", :vector "[",       :map "{"
   :list "(", :eval "#=",  :uneval "#_",      :fn "#("
   :set "#{", :deref "@",  :reader-macro "#", :unquote "~"
   :var "#'", :quote "'",  :syntax-quote "`", :unquote-splicing "~@"})

(defn- prior-line-string [zloc]
  (loop [zloc     zloc
         worklist '()]
    (if-let [p (zip/left zloc)]
      (let [s            (str (n/string (z/node p)))
            new-worklist (cons s worklist)]
        (if-not (includes? s "\n")
          (recur p new-worklist)
          (apply str new-worklist)))
      (if-let [p (zip/up zloc)]
        ;; newline cannot be introduced by start-element
        (recur p (cons (start-element (n/tag (z/node p))) worklist))
        (apply str worklist)))))

(defn- last-line-in-string [^String s]
  (subs s (inc (.lastIndexOf s "\n"))))

(defn- margin [zloc]
  (-> zloc prior-line-string last-line-in-string count))

(defn- whitespace [width]
  (n/whitespace-node (apply str (repeat width " "))))

(defn- coll-indent [zloc]
  (-> zloc zip/leftmost margin))

(defn- index-of [zloc]
  (->> (iterate z/left zloc)
       (take-while identity)
       (count)
       (dec)))

(defn- list-indent [zloc]
  (if (> (index-of zloc) 1)
    (-> zloc zip/leftmost z/right margin)
    (coll-indent zloc)))

(def indent-size 2)

(defn- indent-width [zloc]
  (case (z/tag zloc)
    :list indent-size
    :fn   (inc indent-size)))

(defn- remove-namespace [x]
  (if (symbol? x) (symbol (name x)) x))

(defn pattern? [v]
  (instance? js/RegExp v))

(defn- indent-matches? [key sym]
  (cond
    (symbol? key) (= key sym)
    (pattern? key) (re-find key (str sym))))

(defn- token? [zloc]
  (= (z/tag zloc) :token))

(defn- token-value [zloc]
  (and (token? zloc) (z/sexpr zloc)))

(defn- reader-conditional? [zloc]
  (and (reader-macro? zloc) (#{"?" "?@"} (-> zloc z/down token-value str))))

(defn- form-symbol [zloc]
  (-> zloc z/leftmost token-value))

(defn- index-matches-top-argument? [zloc depth idx]
  (and (> depth 0)
       (= (inc idx) (index-of (nth (iterate z/up zloc) depth)))))

(defn- fully-qualify-symbol [possible-sym alias-map]
  (if-let [ns-string (and (symbol? possible-sym)
                          (namespace possible-sym))]
    (symbol (get alias-map ns-string ns-string)
            (name possible-sym))
    possible-sym))

(defn- inner-indent [zloc key depth idx alias-map]
  (let [top (nth (iterate z/up zloc) depth)]
    (if (and (or (indent-matches? key (fully-qualify-symbol (form-symbol top) alias-map))
                 (indent-matches? key (remove-namespace (form-symbol top))))
             (or (nil? idx) (index-matches-top-argument? zloc depth idx)))
      (let [zup (z/up zloc)]
        (+ (margin zup) (indent-width zup))))))

(defn- nth-form [zloc n]
  (reduce (fn [z f] (if z (f z)))
          (z/leftmost zloc)
          (repeat n z/right)))

(defn- first-form-in-line? [zloc]
  (and (some? zloc)
       (if-let [zloc (zip/left zloc)]
         (if (whitespace? zloc)
           (recur zloc)
           (or (zlinebreak? zloc) (comment? zloc)))
         true)))

(defn- block-indent [zloc key idx alias-map]
  (if (or (indent-matches? key (fully-qualify-symbol (form-symbol zloc) alias-map))
          (indent-matches? key (remove-namespace (form-symbol zloc))))
    (let [zloc-after-idx (some-> zloc (nth-form (inc idx)))]
      (if (and (or (nil? zloc-after-idx) (first-form-in-line? zloc-after-idx))
               (> (index-of zloc) idx))
        (inner-indent zloc key 0 nil alias-map)
        (list-indent zloc)))))

(def default-indents
  (merge (read-resource "cljfmt/indents/clojure.clj")
         (read-resource "cljfmt/indents/compojure.clj")
         (read-resource "cljfmt/indents/fuzzy.clj")))

(defmulti ^:private indenter-fn
  (fn [sym alias-map [type & args]] type))

(defmethod indenter-fn :inner [sym alias-map [_ depth idx]]
  (fn [zloc] (inner-indent zloc sym depth idx alias-map)))

(defmethod indenter-fn :block [sym alias-map [_ idx]]
  (fn [zloc] (block-indent zloc sym idx alias-map)))

(defn- make-indenter [[key opts] alias-map]
  (apply some-fn (map (partial indenter-fn key alias-map) opts)))

(defn- indent-order [[key _]]
  (cond
    (and (symbol? key) (namespace key)) (str 0 key)
    (symbol? key) (str 1 key)
    (pattern? key) (str 2 key)))

(defn- custom-indent [zloc indents alias-map]
  (if (empty? indents)
    (list-indent zloc)
    (let [indenter (->> (sort-by indent-order indents)
                        (map #(make-indenter % alias-map))
                        (apply some-fn))]
      (or (indenter zloc)
          (list-indent zloc)))))

(defn- indent-amount [zloc indents alias-map]
  (let [tag (-> zloc z/up z/tag)
        gp  (-> zloc z/up z/up)]
    (cond
      (reader-conditional? gp) (coll-indent zloc)
      (#{:list :fn} tag)       (custom-indent zloc indents alias-map)
      (= :meta tag)            (indent-amount (z/up zloc) indents alias-map)
      :else                    (coll-indent zloc))))

(defn- indent-line [zloc indents alias-map]
  (let [width (indent-amount zloc indents alias-map)]
    (if (> width 0)
      (zip/insert-right zloc (whitespace width))
      zloc)))

(defn indent
  ([form]
   (indent form default-indents))
  ([form indents]
   (transform form edit-all should-indent? #(indent-line % indents {})))
  ([form indents alias-map]
   (transform form edit-all should-indent? #(indent-line % indents alias-map))))

(defn reindent
  ([form]
   (indent (unindent form)))
  ([form indents]
   (indent (unindent form) indents))
  ([form indents alias-map]
   (indent (unindent form) indents alias-map)))

(defn root? [zloc]
  (nil? (zip/up zloc)))

(defn final? [zloc]
  (and (nil? (zip/right zloc)) (root? (zip/up zloc))))

(defn- trailing-whitespace? [zloc]
  (and (whitespace? zloc)
       (or (zlinebreak? (zip/right zloc)) (final? zloc))))

(defn remove-trailing-whitespace [form]
  (transform form edit-all trailing-whitespace? zip/remove))

(defn- top-level-form [zloc]
  (->> zloc
       (iterate z/up)
       (take-while (complement root?))
       last))

(def default-line-separator
  \newline)

(defn normalize-newlines [s]
  (str/replace s #"\r\n" "\n"))

(defn replace-newlines [s sep]
  (str/replace s #"\n" sep))

(defn find-line-separator [s]
  (or (re-find #"\r?\n" s) default-line-separator))

(defn wrap-normalize-newlines [f]
  (fn [s]
    (let [sep (find-line-separator s)]
      (-> s normalize-newlines f (replace-newlines sep)))))
(defn- append-newline-if-absent [zloc]
  (if (or (-> zloc zip/right skip-whitespace skip-comma line-break?)
          (z/rightmost? zloc))
      zloc
      (zip/insert-right zloc (n/newlines 1))))

(defn- map-odd-seq
  "Applies f to all oddly-indexed nodes."
  [f zloc]
  (loop [loc (z/down zloc)
         parent zloc]
    (if-not (and loc (z/node loc))
      parent
      (if-let [v (f loc)]
        (recur (z/right (z/right v)) (z/up v))
        (recur (z/right (z/right loc)) parent)))))

(defn- map-even-seq
  "Applies f to all evenly-indexed nodes."
  [f zloc]
  (loop [loc   (z/right (z/down zloc))
         parent zloc]
    (if-not (and loc (z/node loc))
      parent
      (if-let [v (f loc)]
        (recur (z/right (z/right v)) (z/up v))
        (recur (z/right (z/right loc)) parent)))))

(defn- add-map-newlines [zloc]
  (map-even-seq #(cond-> % (complement z/rightmost?)
                         append-newline-if-absent) zloc))

(defn- add-binding-newlines [zloc]
  (map-even-seq append-newline-if-absent zloc))

(defn- update-in-path [[node path :as loc] k f]
  (let [v (get path k)]
    (if (seq v)
      (with-meta
        [node (assoc path k (f v) :changed? true)]
        (meta loc))
      loc)))

(defn- remove-right
  [loc]
  (update-in-path loc :r next))

(defn- *remove-right-while
  [zloc p?]
  (loop [zloc zloc]
    (if-let [rloc (zip/right zloc)]
      (if (p? rloc)
        (recur (remove-right zloc))
        zloc)
      zloc)))

(defn- align-seq-value [zloc max-length]
  (let [key-length (-> zloc z/sexpr str count)
        width      (- max-length key-length)
        zloc       (*remove-right-while zloc zwhitespace?)]
    (zip/insert-right zloc (whitespace (inc width)))))

(defn- align-map [zloc]
  (let [key-list       (-> zloc z/sexpr keys)
        max-key-length (apply max (map #(-> % str count) key-list))]
    (map-odd-seq #(align-seq-value % max-key-length) zloc)))

(defn- align-binding [zloc]
  (let [vec-sexpr    (z/sexpr zloc)
        odd-elements (take-nth 2 vec-sexpr)
        max-length   (apply max (map #(-> % str count) odd-elements))]
    (map-odd-seq #(align-seq-value % max-length) zloc)))

(defn- align-elements [zloc]
  (if (z/map? zloc)
      (-> zloc align-map add-map-newlines)
      (-> zloc align-binding add-binding-newlines)))

(def ^:private binding-keywords
  #{"doseq" "let" "loop" "binding" "with-open" "go-loop" "if-let" "when-some"
    "if-some" "for" "with-local-vars" "with-redefs"})

(defn- binding? [zloc]
  (and (z/vector? zloc)
       (-> zloc z/sexpr count even?)
       (->> zloc
            z/left
            z/string
            (contains? binding-keywords))))

(defn- align-binding? [zloc]
  (and (binding? zloc)
       (-> zloc z/sexpr count (> 2))))

(defn- empty-seq? [zloc]
  (if (z/map? zloc)
      (-> zloc z/sexpr empty?)
      false))

(defn- align-map? [zloc]
  (and (z/map? zloc)
       (not (empty-seq? zloc))))

(defn- align-elements? [zloc]
  (or (align-binding? zloc)
      (align-map? zloc)))

(defn align-collection-elements [form]
  (transform form edit-all align-elements? align-elements))


(defn reformat-form
  ([form]
   (reformat-form form {}))
  ([form opts]
   (-> form
      (cond-> (:remove-consecutive-blank-lines? opts true)
        remove-consecutive-blank-lines)
      (cond-> (:remove-surrounding-whitespace? opts true)
        remove-surrounding-whitespace)
      (cond-> (:insert-missing-whitespace? opts true)
        insert-missing-whitespace)
      (cond-> (:align-associative? opts true)
        align-collection-elements)
      (cond-> (:indentation? opts true)
        (reindent (:indents opts default-indents)))
      (cond-> (:remove-trailing-whitespace? opts true)
        remove-trailing-whitespace))))


(defn reformat-string
  ([form-string]
   (reformat-string form-string {}))
  ([form-string options]
   (let [parsed-form (p/parse-string-all form-string)
         alias-map   (:alias-map options)]
     (-> parsed-form
         (reformat-form (cond-> options
                          alias-map (assoc :alias-map alias-map)))
         (n/string)))))
