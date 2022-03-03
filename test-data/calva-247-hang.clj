;; https://github.com/BetterThanTomorrow/calva/issues/1573

;; Confirm that structural editing works here:

(defn foo [{:keys [bar]}] 'baz)

;; Then place the cursor inside the last paren and press delete

([{)

;; Calva stops working 😭

