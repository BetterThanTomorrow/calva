(ns pez-rewrite-clj.paredit
  "This namespace provides zipper operations for performing paredit type of
  operations on clojure/clojurescript forms.

  You might find inspirational examples here: http://pub.gajendra.net/src/paredit-refcard.pdf"
  (:require [pez-rewrite-clj.zip :as z]
            [clojure.zip :as zz]
            [pez-rewrite-clj.zip.whitespace :as ws]
            [pez-rewrite-clj.zip.utils :as u]
            [pez-rewrite-clj.node :as nd]
            [pez-rewrite-clj.node.stringz :as sn :refer [StringNode] ]
            [clojure.string :as cstring]))




;;*****************************
;; Helpers
;;*****************************

(defn- ^{:no-doc true} empty-seq? [zloc]
  (and (z/seq? zloc) (not (seq (z/sexpr zloc)))))

;; helper
(defn ^{:no-doc true} move-n [loc f n]
  (if (= 0 n)
    loc
    (->> loc (iterate f) (take (inc n)) last)))

(defn- ^{:no-doc true} top
  [zloc]
  (->> zloc
       (iterate z/up)
       (take-while identity)
       last))

;; TODO : not very efficent ...
(defn- ^{:no-doc true} global-find-by-node
  [zloc n]
  (-> zloc
      top
      (z/find zz/next #(= (meta (z/node %)) (meta n)))))



(defn- ^{:no-doc true} nodes-by-dir
  ([zloc f] (nodes-by-dir zloc f constantly))
  ([zloc f p?]
   (->> zloc
        (iterate f)
        (take-while identity)
        (take-while p?)
        (map z/node))))

(defn- ^{:no-doc true} remove-first-if-ws [nodes]
  (when (seq nodes)
    (if (nd/whitespace? (first nodes))
      (rest nodes)
      nodes)))


(defn- ^{:no-doc true} remove-ws-or-comment [zloc]
  (if-not (ws/whitespace-or-comment? zloc)
    zloc
    (recur (zz/remove zloc))))


(defn- ^{:no-doc true} create-seq-node
  "Creates a sequence node of given type `t` with node values of `v`"
  [t v]
  (case t
    :list (nd/list-node v)
    :vector (nd/vector-node v)
    :map (nd/map-node v)
    :set (nd/set-node v)
    (throw (js/Error. (str "Unsupported wrap type: " t)))))

(defn- ^{:no-doc true} string-node? [zloc]
  (= (some-> zloc z/node type) (type (nd/string-node " "))))

;;*****************************
;; Paredit functions
;;*****************************




(defn kill
  "Kill all sibling nodes to the right of the current node

  - [1 2| 3 4] => [1 2|]"
  [zloc]
  (let [left (zz/left zloc)]
     (-> zloc
         (u/remove-right-while (constantly true))
         zz/remove
         (#(if left
            (global-find-by-node % (z/node left))
            %)))))



(defn- ^{:no-doc true} kill-in-string-node [zloc pos]
  (if (= (z/string zloc) "\"\"")
    (z/remove zloc)
    (let [bounds (-> zloc z/node meta)
          row-idx (- (:row pos) (:row bounds))
          sub-length (if-not (= (:row pos) (:row bounds))
                       (dec (:col pos))
                       (- (:col pos) (inc (:col bounds))))]

      (-> (take (inc row-idx) (-> zloc z/node :lines))
          vec
          (update-in [row-idx] #(.substring % 0 sub-length))
          (#(z/replace zloc (nd/string-node %)))))))

(defn- ^{:no-doc true} kill-in-comment-node [zloc pos]
  (let [col-bounds (-> zloc z/node meta :col)]
    (if (= (:col pos) col-bounds)
      (z/remove zloc)
      (-> zloc
          (z/replace (-> zloc
                         z/node
                         :s
                         (.substring 0 (- (:col pos) col-bounds 1))
                         nd/comment-node))
          (#(if (zz/right %)
              (zz/insert-right % (nd/newlines 1))
              %))))))



(defn kill-at-pos
  "In string and comment aware kill

  Perform kill for given position `pos` Like [[kill]], but:

  - if inside string kills to end of string and stops there
  - If inside comment kills to end of line (not including linebreak!)

  `pos` should provide `{:row :col }` which are relative to the start of the given form the zipper represents
  `zloc` must be positioned at a node previous (given depth first) to the node at given pos"
  [zloc pos]
  (if-let [candidate (z/find-last-by-pos zloc pos)]
    (cond
     (string-node? candidate)                             (kill-in-string-node candidate pos)
     (ws/comment? candidate)                              (kill-in-comment-node candidate pos)
     (and (empty-seq? candidate)
          (> (:col pos) (-> candidate z/node meta :col))) (z/remove candidate)
     :else                                                (kill candidate))
    zloc))



(defn-  ^{:no-doc true} find-word-bounds
  [v col]
  (when (<= col (count v))
    [(->> (seq v)
          (take col)
          reverse
          (take-while #(not (= % \space))) count (- col))
     (->> (seq v)
          (drop col)
          (take-while #(not (or (= % \space) (= % \newline))))
          count
          (+  col))]))


(defn-  ^{:no-doc true} remove-word-at
  [v col]
  (when-let [[start end] (find-word-bounds v col)]
    (str (.substring v 0 start)
         (.substring v end))))



(defn- ^{:no-doc true} kill-word-in-comment-node [zloc pos]
  (let [col-bounds (-> zloc z/node meta :col)]
  (-> zloc
      (z/replace (-> zloc
                     z/node
                     :s
                     (remove-word-at (- (:col pos) col-bounds))
                     nd/comment-node)))))

(defn- ^{:no-doc true} kill-word-in-string-node [zloc pos]
  (let [bounds (-> zloc z/node meta)
        row-idx (- (:row pos) (:row bounds))
        col (if (= 0 row-idx)
              (- (:col pos) (:col bounds))
              (:col pos))]
  (-> zloc
      (z/replace (-> zloc
                     z/node
                     :lines
                     (update-in [row-idx]
                                #(remove-word-at % col))
                     nd/string-node)))))



(defn kill-one-at-pos
  "In string and comment aware kill for one node/word at given pos

  - `(+ |100 100) => (+ |100)`
  - `(for |(bar do)) => (foo)`
  - `\"|hello world\" => \"| world\"`
  - ` ; |hello world => ;  |world`"
  [zloc pos]
  (if-let [candidate (->> (z/find-last-by-pos zloc pos)
                          (ws/skip zz/right ws/whitespace?))]
    (let [bounds (-> candidate z/node meta)
          kill-in-node? (not (and (= (:row pos) (:row bounds))
                                  (<= (:col pos) (:col bounds))))]
      (cond
       (and kill-in-node? (string-node? candidate)) (kill-word-in-string-node candidate pos)
       (and kill-in-node? (ws/comment? candidate)) (kill-word-in-comment-node candidate pos)
       (not (z/leftmost? candidate)) (-> (z/remove candidate)
                                         (global-find-by-node (-> candidate z/left z/node)))
       :else (z/remove candidate)))
    zloc))


(defn- ^{:no-doc true} find-slurpee-up [zloc f]
  (loop [l (z/up zloc)
         n 1]
    (cond
     (nil? l) nil
     (not (nil? (f l))) [n (f l)]
     (nil? (z/up l)) nil
     :else (recur (z/up l) (inc n)))))

(defn- ^{:no-doc true} find-slurpee [zloc f]
  (if (empty-seq? zloc)
    [(f zloc) 0]
    (some-> zloc (find-slurpee-up f) reverse)))




(defn slurp-forward
  "Pull in next right outer node (if none at first level, tries next etc) into
  current S-expression

  - `[1 2 [|3] 4 5] => [1 2 [|3 4] 5]`"
  [zloc]
  (let [[slurpee-loc n-ups] (find-slurpee zloc z/right)]
    (if-not slurpee-loc
      zloc
      (let [slurper-loc (move-n zloc z/up n-ups)
            preserves (->> (-> slurper-loc
                               zz/right
                               (nodes-by-dir zz/right #(not (= (z/node slurpee-loc) (z/node %)))))
                           (filter #(or (nd/linebreak? %) (nd/comment? %))))]
        (-> slurper-loc
            (u/remove-right-while ws/whitespace-or-comment?)
            u/remove-right
            ((partial reduce z/append-child) preserves)
            (z/append-child (z/node slurpee-loc))
            (#(if (empty-seq? zloc)
                (-> % z/down (u/remove-left-while ws/whitespace?))
                (global-find-by-node % (z/node zloc)))))))))

(defn slurp-forward-fully
  "Pull in all right outer-nodes into current S-expression, but only the ones at the same level
  as the the first one.

  - `[1 2 [|3] 4 5] => [1 2 [|3 4 5]]`"
  [zloc]
  (let [curr-slurpee (some-> zloc (find-slurpee z/right) first)
        num-slurps (some-> curr-slurpee (nodes-by-dir z/right) count inc)]

    (->> zloc
          (iterate slurp-forward)
          (take num-slurps)
          last)))


(defn slurp-backward
  "Pull in prev left outer node (if none at first level, tries next etc) into
  current S-expression

  - `[1 2 [|3] 4 5] => [1 [2 |3] 4 5]`"
  [zloc]
  (if-let [[slurpee-loc _] (find-slurpee zloc z/left)]
    (let [preserves (->> (-> slurpee-loc
                             zz/right
                             (nodes-by-dir zz/right ws/whitespace-or-comment?))
                         (filter #(or (nd/linebreak? %) (nd/comment? %))))]
      (-> slurpee-loc
          (u/remove-left-while ws/whitespace-not-linebreak?)
          (#(if (and (z/left slurpee-loc)
                     (not (ws/linebreak? (zz/left %))))
              (ws/prepend-space %)
              %))
          (u/remove-right-while ws/whitespace-or-comment?)
          zz/remove
          z/next
          ((partial reduce z/insert-child) preserves)
          (z/insert-child (z/node slurpee-loc))
          (#(if (empty-seq? zloc)
              (-> % z/down (u/remove-right-while ws/linebreak?))
              (global-find-by-node % (z/node zloc))))))
    zloc))

(defn slurp-backward-fully
  "Pull in all left outer-nodes into current S-expression, but only the ones at the same level
  as the the first one.

  - `[1 2 [|3] 4 5] => [[1 2 |3] 4 5]`"
  [zloc]
  (let [curr-slurpee (some-> zloc (find-slurpee z/left) first)
        num-slurps (some-> curr-slurpee (nodes-by-dir z/left) count inc)]

    (->> zloc
          (iterate slurp-backward)
          (take num-slurps)
          last)))


(defn barf-forward
  "Push out the rightmost node of the current S-expression into outer right form

  - `[1 2 [|3 4] 5] => [1 2 [|3] 4 5]`"
  [zloc]
  (let [barfee-loc (z/rightmost zloc)]

    (if-not (z/up zloc)
      zloc
      (let [preserves (->> (-> barfee-loc
                               zz/left
                               (nodes-by-dir zz/left ws/whitespace-or-comment?))
                           (filter #(or (nd/linebreak? %) (nd/comment? %)))
                           reverse)]
        (-> barfee-loc
            (u/remove-left-while ws/whitespace-or-comment?)
            (u/remove-right-while ws/whitespace?)
             u/remove-and-move-up
            (z/insert-right (z/node barfee-loc))
            ((partial reduce z/insert-right) preserves)
            (#(or (global-find-by-node % (z/node zloc))
                 (global-find-by-node % (z/node barfee-loc)))))))))


(defn barf-backward
  "Push out the leftmost node of the current S-expression into outer left form

  - `[1 2 [3 |4] 5] => [1 2 3 [|4] 5]`"
  [zloc]
  (let [barfee-loc (z/leftmost zloc)]
    (if-not (z/up zloc)
      zloc
      (let [preserves (->> (-> barfee-loc
                               zz/right
                               (nodes-by-dir zz/right ws/whitespace-or-comment?))
                           (filter #(or (nd/linebreak? %) (nd/comment? %))))]
        (-> barfee-loc
            (u/remove-left-while ws/whitespace?)
            (u/remove-right-while ws/whitespace-or-comment?) ;; probably insert space when on same line !
            zz/remove
            (z/insert-left (z/node barfee-loc))
            ((partial reduce z/insert-left) preserves)
            (#(or (global-find-by-node % (z/node zloc))
                  (global-find-by-node % (z/node barfee-loc)))))))))


(defn wrap-around
  "Wrap current node with a given type `t` (:vector, :list, :set, :map :fn)

  - `|123 => [|123] ; given :vector`
  - `|[1 [2]] => [|[1 [2]]]`"
  [zloc t]
  (-> zloc
      (z/insert-left (create-seq-node t nil))
      z/left
      (u/remove-right-while ws/whitespace?)
      u/remove-right
      (zz/append-child (z/node zloc))
      z/down))

(defn wrap-fully-forward-slurp
  "Create a new seq node of type `t` left of `zloc` then slurp fully into the new node

  - `[1 |2 3 4] => [1 [|2 3 4]]`"
  [zloc t]
  (-> zloc
      (z/insert-left (create-seq-node t nil))
      z/left
      slurp-forward-fully))

(def splice
  "See pez-rewrite-clj.zip/splice"
  z/splice)


(defn- ^{:no-doc true} splice-killing
  [zloc f]
  (if-not (z/up zloc)
    zloc
    (-> zloc
        (f (constantly true))
        z/up
        splice
        (global-find-by-node (z/node zloc)))))

(defn splice-killing-backward
  "Remove left siblings of current given node in S-Expression and unwrap remaining into enclosing S-expression

  - `(foo (let ((x 5)) |(sqrt n)) bar) => (foo (sqrt n) bar)`"
  [zloc]
  (splice-killing zloc u/remove-left-while))

(defn splice-killing-forward
  "Remove current given node and its right siblings in S-Expression and unwrap remaining into enclosing S-expression

  - `(a (b c |d e) f) => (a b |c f)`"
  [zloc]
  (if (and (z/up zloc) (not (z/leftmost? zloc)))
    (splice-killing (z/left zloc) u/remove-right-while)
    (if (z/up zloc)
      (-> zloc z/up z/remove)
      zloc)))


(defn split
  "Split current s-sexpression in two at given node `zloc`

  -  `[1 2 |3 4 5] => [1 2 3] [4 5]`"
  [zloc]
  (let [parent-loc (z/up zloc)]
    (if-not parent-loc
      zloc
      (let [t (z/tag parent-loc)
            lefts (reverse (remove-first-if-ws (rest (nodes-by-dir (z/right zloc) zz/left))))
            rights (remove-first-if-ws (nodes-by-dir (z/right zloc) zz/right))]

        (if-not (and (seq lefts) (seq rights))
          zloc
          (-> parent-loc
              (z/insert-left (create-seq-node t lefts))
              (z/insert-left (create-seq-node t rights))
              z/remove
              (#(or (global-find-by-node % (z/node zloc))
                    (global-find-by-node % (last lefts))))))))))


(defn- ^{:no-doc true} split-string [zloc pos]
  (let [bounds (-> zloc z/node meta)
        row-idx (- (:row pos) (:row bounds))
        lines (-> zloc z/node :lines)
        split-col (if-not (= (:row pos) (:row bounds))
                    (dec (:col pos))
                    (- (:col pos) (inc (:col bounds))))]
    (-> zloc
        (z/replace (nd/string-node
                    (-> (take (inc row-idx) lines)
                        vec
                        (update-in [row-idx] #(.substring % 0 split-col)))))
        (z/insert-right (nd/string-node
                         (-> (drop row-idx lines)
                               vec
                             (update-in [0] #(.substring % split-col))))))))


(defn split-at-pos
  "In string aware split

  Perform split at given position `pos` Like split, but:

  - if inside string splits string into two strings

  `pos` should provide `{:row :col }` which are relative to the start of the given form the zipper represents
  `zloc` must be positioned at a node previous (given depth first) to the node at given pos"
  [zloc pos]
  (if-let [candidate (z/find-last-by-pos zloc pos)]
    (if (string-node? candidate)
      (split-string candidate pos)
      (split candidate))
    zloc))

(defn- ^{:no-doc true} join-seqs [left right]
  (let [lefts (-> left z/node nd/children)
            ws-nodes (-> (zz/right left) (nodes-by-dir zz/right ws/whitespace-or-comment?))
            rights (-> right z/node nd/children)]

        (-> right
            zz/remove
            remove-ws-or-comment
            z/up
            (z/insert-left (create-seq-node :vector
                                            (concat lefts
                                                    ws-nodes
                                                    rights)))
            z/remove
            (global-find-by-node (first rights)))))


(defn- ^{:no-doc true} join-strings [left right]
  (-> right
      zz/remove
      remove-ws-or-comment
      (z/replace (nd/string-node (str (-> left z/node nd/sexpr)
                                      (-> right z/node nd/sexpr))))))

(defn join
  "Join S-expression to the left and right of current loc. Also works for strings.

  - `[[1 2] |[3 4]] => [[1 2 3 4]]`
  - `[\"Hello \" | \"World\"] => [\"Hello World\"]"
  [zloc]
  (let [left (some-> zloc z/left)
        right (if (some-> zloc z/node nd/whitespace?) (z/right zloc) zloc)]


    (if-not (and left right)
      zloc
      (cond
       (and (z/seq? left) (z/seq? right)) (join-seqs left right)
       (and (string-node? left) (string-node? right)) (join-strings left right)
       :else zloc))))


(defn raise
  "Delete siblings and raise node at zloc one level up

  - `[1 [2 |3 4]] => [1 |3]`"
  [zloc]
  (if-let [containing (z/up zloc)]
    (-> containing
        (z/replace (z/node zloc)))
    zloc))


(defn move-to-prev
  "Move node at current location to the position of previous location given a depth first traversal

    -  `(+ 1 (+ 2 |3) 4) => (+ 1 (+ |3 2) 4)`
    - `(+ 1 (+ 2 3) |4) => (+ 1 (+ 2 3 |4))`

  returns zloc after move or given zloc if a move isn't possible"
  [zloc]
  (let [n (z/node zloc)
        p (some-> zloc z/left z/node)
        ins-fn (if (or (nil? p) (= (-> zloc z/remove z/node) p))
                 #(-> % (z/insert-left n) z/left)
                 #(-> % (z/insert-right n) z/right))]
    (if-not (-> zloc z/remove z/prev)
      zloc
      (-> zloc
          z/remove
          ins-fn))))
