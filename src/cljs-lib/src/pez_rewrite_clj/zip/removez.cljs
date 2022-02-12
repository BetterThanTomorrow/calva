(ns pez-rewrite-clj.zip.removez
  (:refer-clojure :exclude [remove])
  (:require [pez-rewrite-clj.zip.move :as m]
            [pez-rewrite-clj.zip.utils :as u]
            [pez-rewrite-clj.zip.whitespace :as ws]
            [clojure.zip :as z]))


(defn- remove-trailing-space
  "Remove all whitespace following a given node."
  [zloc p?]
  (u/remove-right-while zloc p?))

(defn- remove-preceding-space
  "Remove all whitespace preceding a given node."
  [zloc p?]
  (u/remove-left-while zloc p?))

(defn remove
  "Remove value at the given zipper location. Returns the first non-whitespace
   node that would have preceded it in a depth-first walk. Will remove whitespace
   appropriately.

  - `[1  2  3]   => [1  3]`
  - `[1 2]       => [1]`
  - `[1 2]       => [2]`
  - `[1]         => []`
  - `[  1  ]     => []`
  - `[1 [2 3] 4] => [1 [2 3]]`
  - `[1 [2 3] 4] => [[2 3] 4]`

   If a node is located rightmost, both preceding and trailing spaces are removed,
   otherwise only trailing spaces are touched. This means that a following element
   (no matter whether on the same line or not) will end up in the same position
   (line/column) as the removed one, _unless_ a comment lies between the original
   node and the neighbour."
  [zloc]
  {:pre [zloc]
   :post [%]}
  (->> (-> (if (or (m/rightmost? zloc)
                   (m/leftmost? zloc))
             (remove-preceding-space zloc ws/whitespace?)
             zloc)
           (remove-trailing-space ws/whitespace?)
           z/remove)
       (ws/skip-whitespace z/prev)))

(defn remove-preserve-newline
  "Same as remove but preserves newlines"
  [zloc]
  {:pre [zloc]
   :post [%]}
  (->> (-> (if (or (m/rightmost? zloc)
                   (m/leftmost? zloc))
             (remove-preceding-space zloc #(and (ws/whitespace? %)
                                                (not (ws/linebreak? %))))
             zloc)
           (remove-trailing-space #(and (ws/whitespace? %)
                                                (not (ws/linebreak? %))))
           z/remove)
       (ws/skip-whitespace z/prev)))

