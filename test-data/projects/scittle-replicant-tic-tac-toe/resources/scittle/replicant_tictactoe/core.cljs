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
        event-handler (fn [_ [action & args]]
                        (case action
                          :tic (apply swap! store game/tic args)
                          :reset (start-new-game store)))
        el (js/document.getElementById "app")]

    ;; Globally handle DOM events
    (r/set-dispatch!
     event-handler)

    (def !store store)
    (def event-handler! event-handler)

    ;; Render on every change
    (add-watch store ::render
               (fn [_ _ _ game]
                 (->> (ui/game->ui-data game)
                      ui/render-game
                      (r/render el))))

    ;; Trigger the first render by initializing the game.
    (start-new-game store)))

(main)

(comment
  @!store
  ; Greetings, Professor Falken.
  ; Shall we play a game?
  (event-handler! {} [:tic 0 0])
  (event-handler! {} [:tic 2 2])
  (event-handler! {} [:reset])
  :rcf)

