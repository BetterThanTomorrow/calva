(ns ^:no-doc pez-rewrite-clj.zip.insert
  (:require [pez-rewrite-clj.zip.base :as base]
            [pez-rewrite-clj.zip.whitespace :as ws]
            [pez-rewrite-clj.node :as node]
            [clojure.zip :as z]))

(def ^:private space
  (node/spaces 1))

(defn- insert
  "Generic insertion helper. If the node reached by `move-fn`
   is a whitespace, insert an additional space."
  [move-fn insert-fn prefix zloc item]
  (let [item-node (node/coerce item)
        next-node (move-fn zloc)]
    (->> (if (or (not next-node) (ws/whitespace? next-node))
           (concat [item-node] prefix)
           (concat [space item-node] prefix))
         (reduce insert-fn zloc))))

(defn insert-right
  "Insert item to the right of the current location. Will insert a space if necessary."
  [zloc item]
  (insert
    z/right
    z/insert-right
    [space]
    zloc item))

(defn insert-left
  "Insert item to the right of the left location. Will insert a space if necessary."
  [zloc item]
  (insert
    z/left
    z/insert-left
    [space]
    zloc item))

(defn insert-child
  "Insert item as first child of the current node. Will insert a space if necessary."
  [zloc item]
  (insert
    z/down
    z/insert-child
    []
    zloc item))

(defn append-child
  "Insert item as last child of the current node. Will insert a space if necessary."
  [zloc item]
  (insert
    #(some-> % z/down z/rightmost)
    z/append-child
    []
    zloc item))
