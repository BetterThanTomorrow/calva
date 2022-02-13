(ns ^:no-doc pez-rewrite-clj.zip.utils
  (:require [clojure.zip :as z]))

;; ## Remove

(defn- update-in-path
  [[node path :as loc] k f]
  (let [v (get path k)]
    (if (seq v)
      (with-meta
        [node (assoc path k (f v) :changed? true)]
        (meta loc))
      loc)))

(defn remove-right
  "Remove right sibling of the current node (if there is one)."
  [loc]
  (update-in-path loc :r next))

(defn remove-left
  "Remove left sibling of the current node (if there is one)."
  [loc]
  (update-in-path loc :l pop))


(defn remove-while
  [zloc p?]
  "Remove nodes while predicate true. (depth first in reverse!) "
  (loop [zloc zloc]
    (let [ploc (z/prev zloc)]
      (if-not (and ploc (p? ploc))
        zloc
        (recur (z/remove zloc))))))

(defn remove-right-while
  "Remove elements to the right of the current zipper location as long as
   the given predicate matches."
  [zloc p?]
  (loop [zloc zloc]
    (if-let [rloc (z/right zloc)]
      (if (p? rloc)
        (recur (remove-right zloc))
        zloc)
      zloc)))

(defn remove-left-while
  "Remove elements to the left of the current zipper location as long as
   the given predicate matches."
  [zloc p?]
  (loop [zloc zloc]
    (if-let [lloc (z/left zloc)]
      (if (p? lloc)
        (recur (remove-left zloc))
        zloc)
      zloc)))

;; ## Remove and Move

(defn remove-and-move-left
  "Remove current node and move left. If current node is at the leftmost
   location, returns `nil`."
  [[_ {:keys [l] :as path} :as loc]]
  (if (seq l)
    (with-meta
      [(peek l) (-> path
                    (update-in [:l] pop)
                    (assoc :changed? true))]
      (meta loc))))

(defn remove-and-move-right
  "Remove current node and move right. If current node is at the rightmost
   location, returns `nil`."
  [[_ {:keys [r] :as path} :as loc]]
  (if (seq r)
    (with-meta
      [(first r) (-> path
                     (update-in [:r] next)
                     (assoc :changed? true))]
      (meta loc))))


(defn remove-and-move-up [loc]
  (let [[node {l :l, ppath :ppath, pnodes :pnodes, rs :r, :as path}] loc]
    (if (nil? path)
      (throw (js/Error. "Remove at top"))
      (if (pos? (count l))
        (z/up (with-meta [(peek l)
                    (assoc path :l (pop l) :changed? true)]
                   (meta loc)))
        (with-meta [(z/make-node loc (peek pnodes) rs)
                    (and ppath (assoc ppath :changed? true))]
                   (meta loc))))))

