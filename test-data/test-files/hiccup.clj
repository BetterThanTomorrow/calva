(defonce Stack (rnn-stack/createNativeStackNavigator))

(r/with-let [counter (rf/subscribe [:get-counter])
               tap-enabled? (rf/subscribe [:counter-tappable?])
               remaining-time (rf/subscribe [:timer/remaining-time])]
    [:> rn/View {:style {:flex 1
                         :padding-vertical 50
                         :justify-content :space-between
                         :align-items :center
                         :background-color :white}}])
