(ns ttt-flare
  (:require
   [joyride.flare :as flare]))

(defn replicant-ttt []
  (flare/flare!+
   {:html [:html
           [:head
            [:script "var SCITTLE_NREPL_WEBSOCKET_PORT = 1340;
                      var SCITTLE_NREPL_WEBSOCKET_HOST = '127.0.0.1';"]
            [:script {:src "resources/scittle/js/scittle.js"
                      :type "application/javascript"}]
            #_[:script {:src "https://cdn.jsdelivr.net/npm/scittle@0.7.28/dist/scittle.nrepl.js"
                        :type "application/javascript"}]
            [:script {:src "resources/scittle/js/scittle.nrepl.js"
                      :type "application/javascript"}]
            [:script {:src "resources/scittle/js/scittle.replicant.js"
                      :type "application/javascript"}]
            [:script {:type "application/x-scittle"
                      :src "resources/scittle/replicant_tictactoe/ui.cljs"}]
            [:script {:type "application/x-scittle"
                      :src "resources/scittle/replicant_tictactoe/game.cljs"}]
            [:script {:type "application/x-scittle"
                      :src "resources/scittle/replicant_tictactoe/core.cljs"}]
            [:link {:rel "stylesheet"
                    :href "resources/scittle/replicant_tictactoe/style.css"}]]
           [:body
            [:h1 "Scittle tic-tac-toe built with Replicant"]
            [:ul {:style {:list-style :none
                          :padding-left 0
                          :display :flex
                          :flex-direction :row
                          :gap "0.5rem"}}
             [:li [:a {:href "https://github.com/babashka/scittle"} "Scittle"]]
             [:li [:a {:href "https://replicant.fun"} "Replicant"]]]
            [:div#app]]]
    :key :sidebar-1}))

(comment
  (replicant-ttt)
  :rcf)