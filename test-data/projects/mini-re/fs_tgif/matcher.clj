(ns fs-tgif.matcher)

(defn matches?
  "Determine if `p` matches `s` for the regexp language where
   `*` works as a non-greedy Kleene star."
  [p s]
  (let [[pc1 pc2 & p-remaining] p
        [sc & s-remaining] s]
    (cond
      (nil? pc1) (nil? sc)
      (= pc2 \*) (or (matches? p-remaining s)
                     (and sc (= pc1 sc)
                          (matches? p s-remaining)))
      (= pc1 sc) (matches? (rest p) s-remaining)
      :else false)))

(comment
  (matches? "a" "a") ;=> true
  (matches? "b" "bb") ;=> false
  (matches? "a*a" "a") ;=> true
  (matches? "b*c" "bbbbc") ;=> true
  (matches? "xy*x" "xx") ;=> true
  (matches? "z*z" "zz") ;=> true
  (matches? "m*n" "mmmnm") ;=> false
  (matches? "m*n*" "mmmn") ;= true
  :rcf)