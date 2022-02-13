(ns pez-rewrite-clj.zip.seqz
  (:refer-clojure :exclude [map get assoc seq? vector? list? map? set?])
  (:require [pez-rewrite-clj.zip.base :as base]
            [pez-rewrite-clj.zip.editz :as e]
            [pez-rewrite-clj.zip.findz :as f]
            [pez-rewrite-clj.zip.insert :as i]
            [pez-rewrite-clj.zip.move :as m]
            [clojure.zip :as z]))

;; ## Predicates

(defn seq?
  [zloc]
  (contains?
    #{:forms :list :vector :set :map}
    (base/tag zloc)))

(defn list?
  [zloc]
  (= (base/tag zloc) :list))

(defn vector?
  [zloc]
  (= (base/tag zloc) :vector))

(defn set?
  [zloc]
  (= (base/tag zloc) :set))

(defn map?
  [zloc]
  (= (base/tag zloc) :map))

;; ## Map Operations

(defn- map-seq
  [f zloc]
  {:pre [(seq? zloc)]}
  (if-let [n0 (m/down zloc)]
    (some->> (f n0)
             (iterate
               (fn [loc]
                 (if-let [n (m/right loc)]
                   (f n))))
             (take-while identity)
             (last)
             (m/up))
    zloc))

(defn map-vals
  "Apply function to all value nodes of the given map node."
  [f zloc]
  {:pre [(map? zloc)]}
  (loop [loc (m/down zloc)
         parent zloc]
    (if-not (and loc (z/node loc))
      parent
      (if-let [v0 (m/right loc)]
        (if-let [v (f v0)]
          (recur (m/right v) (m/up v))
          (recur (m/right v0) parent))
        parent))))

(defn map-keys
  "Apply function to all key nodes of the given map node."
  [f zloc]
  {:pre [(map? zloc)]}
  (loop [loc (m/down zloc)
         parent zloc]
    (if-not (and loc (z/node loc))
      parent
      (if-let [v (f loc)]
        (recur (m/right (m/right v)) (m/up v))
        (recur (m/right (m/right loc)) parent)))))

(defn map
  "Apply function to all value nodes in the given seq node. Iterates over
   value nodes of maps but over each element of a seq."
  [f zloc]
  {:pre [(seq? zloc)]}
  (if (map? zloc)
    (map-vals f zloc)
    (map-seq f zloc)))

;; ## Get/Assoc

(defn get
  "If a map is given, get element with the given key; if a seq is given, get nth element."
  [zloc k]
  {:pre [(or (map? zloc) (and (seq? zloc) (integer? k)))]}
  (if (map? zloc)
    (some-> zloc m/down (f/find-value k) m/right)
    (nth
      (some->> (m/down zloc)
               (iterate m/right)
               (take-while identity))
      k)))

(defn assoc
  "Set map/seq element to the given value."
  [zloc k v]
  (if-let [vloc (get zloc k)]
    (-> vloc (e/replace v) m/up)
    (if (map? zloc)
      (-> zloc
          (i/append-child k)
          (i/append-child v))
      (throw
        (js/Error.
          (str "index out of bounds: " k))))))
