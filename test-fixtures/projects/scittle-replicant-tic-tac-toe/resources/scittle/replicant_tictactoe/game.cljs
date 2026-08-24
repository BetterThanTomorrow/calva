;; COPIED FROM https://github.com/cjohansen/replicant-tic-tac-toe/blob/7a33fb12f0cd6658b2f555ff673dee031d4aa921/src/tic_tac_toe/game.cljs

(ns replicant-tictactoe.game)

(defn create-game [{:keys [size]}]
  {:next-player :x
   :size size})

(def next-player {:x :o, :o :x})

(defn winner? [tics path]
  (when (= 1 (count (set (map tics path))))
    path))

(defn get-winning-path [{:keys [size tics]} y x]
  (let [flip-y (fn [y] (- size 1 y))]
    (or (winner? tics (mapv #(vector y %) (range 0 size)))
        (winner? tics (mapv #(vector % x) (range 0 size)))
        (when (= y x)
          (winner? tics (mapv #(vector % %) (range 0 size))))
        (when (= (flip-y y) x)
          (winner? tics (mapv #(vector (flip-y %) %) (range 0 size)))))))

(defn maybe-conclude [game y x]
  (if-let [path (get-winning-path game y x)]
    (-> (dissoc game :next-player)
        (assoc :over? true
               :victory {:player (get-in game [:tics [y x]])
                         :path path}))
    (let [tie? (= (count (:tics game)) (* (:size game) (:size game)))]
      (cond-> game
        tie? (dissoc :next-player)
        tie? (assoc :over? true)))))

(defn tic [game y x]
  (let [player (:next-player game)]
    (if (or (get-in game [:tics [y x]])
            (<= (:size game) x)
            (<= (:size game) y))
      game
      (-> game
          (assoc-in [:tics [y x]] player)
          (assoc :next-player (next-player player))
          (maybe-conclude y x)))))