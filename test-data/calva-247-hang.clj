;; https://github.com/BetterThanTomorrow/calva/issues/1573

;; Confirm that structural editing works here:

(defn foo [{:keys [bar]}] 'baz)

;; Then place the cursor inside the last paren and press delete

([{)

;; Calva stops working 😭

;; Until https://github.com/BetterThanTomorrow/calva/commit/d77359fcea16bc052ab829853d5711434330a375
;; 🎉