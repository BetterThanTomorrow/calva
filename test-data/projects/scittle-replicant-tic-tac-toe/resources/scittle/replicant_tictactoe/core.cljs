;; COPIED FROM https://github.com/cjohansen/replicant-tic-tac-toe/blob/7a33fb12f0cd6658b2f555ff673dee031d4aa921/src/tic_tac_toe/core.cljs

(ns replicant-tictactoe.core
  (:require [replicant.dom :as r]
            [replicant-tictactoe.game :as game]
            [replicant-tictactoe.ui :as ui]))

(defn start-new-game [store]
  (reset! store (game/create-game {:size 3})))

(defn main []
  ;; Set up the atom
  (let [store (atom nil)
        el (js/document.getElementById "app")]

    ;; Globally handle DOM events
    (r/set-dispatch!
     (fn [_ [action & args]]
       (case action
         :tic (apply swap! store game/tic args)
         :reset (start-new-game store))))

    ;; Render on every change
    (add-watch store ::render
               (fn [_ _ _ game]
                 (->> (ui/game->ui-data game)
                      ui/render-game
                      (r/render el))))

    ;; Trigger the first render by initializing the game.
    (start-new-game store)))

(main)
