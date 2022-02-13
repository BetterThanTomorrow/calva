(ns pez-rewrite-clj.zip.move
  (:refer-clojure :exclude [next])
  (:require [pez-rewrite-clj.zip.whitespace :as ws]
            [clojure.zip :as z]))

(defn right
  "Move right to next non-whitespace/non-comment location."
  [zloc]
  (some-> zloc z/right ws/skip-whitespace))

(defn left
  "Move left to next non-whitespace/non-comment location."
  [zloc]
  (some-> zloc z/left ws/skip-whitespace-left))

(defn down
  "Move down to next non-whitespace/non-comment location."
  [zloc]
  (some-> zloc z/down ws/skip-whitespace))

(defn up
  "Move up to next non-whitespace/non-comment location."
  [zloc]
  (some-> zloc z/up ws/skip-whitespace-left))

(defn next
  "Move to the next non-whitespace/non-comment location in a depth-first manner."
  [zloc]
  (when zloc
    (or (some->> zloc
                 z/next
                 (ws/skip-whitespace z/next))
        (vary-meta zloc assoc ::end? true))))

(defn end?
  "Check whether the given node is at the end of the depth-first traversal."
  [zloc]
  (or (not zloc)
      (z/end? zloc)
      (::end? (meta zloc))))

(defn rightmost?
  "Check if the given location represents the leftmost non-whitespace/
   non-comment one."
  [zloc]
  (nil? (ws/skip-whitespace (z/right zloc))))

(defn leftmost?
  "Check if the given location represents the leftmost non-whitespace/
   non-comment one."
  [zloc]
  (nil? (ws/skip-whitespace-left (z/left zloc))))

(defn prev
  "Move to the next non-whitespace/non-comment location in a depth-first manner."
  [zloc]
  (some->> zloc
           z/prev
           (ws/skip-whitespace z/prev)))

(defn leftmost
  "Move to the leftmost non-whitespace/non-comment location."
  [zloc]
  (some-> zloc
          z/leftmost
          ws/skip-whitespace))

(defn rightmost
  "Move to the rightmost non-whitespace/non-comment location."
  [zloc]
  (some-> zloc
          z/rightmost
          ws/skip-whitespace-left))
