(ns pez-rewrite-clj.zip.findz
  (:refer-clojure :exclude [find])
  (:require [pez-rewrite-clj.zip.base :as base]
            [pez-rewrite-clj.zip.move :as m]
            [pez-rewrite-clj.node :as node]
            [pez-rewrite-clj.zip.whitespace :as ws]
            [clojure.zip :as z]))

;; ## Helpers

(defn- tag-predicate
  [t & [additional]]
  (if additional
    (fn [node]
      (and (= (base/tag node) t)
           (additional node)))
    #(= (base/tag %) t)))


(defn in-range? [{:keys [row col end-row end-col]} {r :row c :col}]
  (and (>= r row)
       (<= r end-row)
       (if (= r row) (>= c col) true)
       (if (= r end-row) (<= c end-col) true)))


;; ## Find Operations

(defn find
  "Find node satisfying the given predicate by repeatedly
   applying the given movement function to the initial zipper
   location."
  ([zloc p?]
   (find zloc m/right p?))
  ([zloc f p?]
   (->> zloc
        (iterate f)
        (take-while identity)
        (take-while (complement m/end?))
        (drop-while (complement p?))
        (first))))



(defn find-last-by-pos
  "Find last node (if more than one node) that is in range of pos and
  satisfying the given predicate depth first from initial zipper
  location."
  ([zloc pos] (find-last-by-pos zloc pos (constantly true)))
  ([zloc pos p?]
   (->> zloc
        (iterate z/next)
        (take-while identity)
        (take-while (complement m/end?))
        (filter #(and (p? %)
                      (in-range? (-> % z/node meta) pos)))
        last)))


(defn find-depth-first
  "Find node satisfying the given predicate by traversing
   the zipper in a depth-first way."
  [zloc p?]
  (find zloc m/next p?))


(defn find-next
  "Find node other than the current zipper location matching
   the given predicate by applying the given movement function
   to the initial zipper location."
  ([zloc p?]
   (find-next zloc m/right p?))
  ([zloc f p?]
   (some-> zloc f (find f p?))))

(defn find-next-depth-first
  "Find node other than the current zipper location matching
   the given predicate by traversing the zipper in a
   depth-first way."
  [zloc p?]
  (find-next zloc m/next p?))

(defn find-tag
  "Find node with the given tag by repeatedly applying the given
   movement function to the initial zipper location."
  ([zloc t]
   (find-tag zloc m/right t))
  ([zloc f t]
   (find zloc f #(= (base/tag %) t))))

(defn find-next-tag
  "Find node other than the current zipper location with the
   given tag by repeatedly applying the given movement function to
   the initial zipper location."
  ([zloc t]
   (find-next-tag zloc m/right t))
  ([zloc f t]
   (->> (tag-predicate t)
        (find-next zloc f))))


(defn find-tag-by-pos
  "Find node with the given tag and pos depth-first from initial zipper location."
  ([zloc pos t]
   (find-last-by-pos zloc pos #(= (base/tag %) t))))



(defn find-token
  "Find token node matching the given predicate by applying the
   given movement function to the initial zipper location, defaulting
   to `right`."
  ([zloc p?]
   (find-token zloc m/right p?))
  ([zloc f p?]
   (->> (tag-predicate :token p?)
        (find zloc f))))

(defn find-next-token
  "Find next token node matching the given predicate by applying the
   given movement function to the initial zipper location, defaulting
   to `right`."
  ([zloc p?]
   (find-next-token zloc m/right p?))
  ([zloc f p?]
   (find-token (f zloc) f p?)))

(defn find-value
  "Find token node whose value matches the given one by applying the
   given movement function to the initial zipper location, defaulting
   to `right`."
  ([zloc v]
   (find-value zloc m/right v))
  ([zloc f v]
   (let [p? (if (set? v)
              (comp v base/sexpr)
              #(= (base/sexpr %) v))]
     (find-token zloc f p?))))

(defn find-next-value
  "Find next token node whose value matches the given one by applying the
   given movement function to the initial zipper location, defaulting
   to `right`."
  ([zloc v]
   (find-next-value zloc m/right v))
  ([zloc f v]
   (find-value (f zloc) f v)))
