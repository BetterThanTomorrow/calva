(ns main.common)

(defn hello [s]
  #?(:cljs (js/console.log "Hello" s)
     :clj (println "Hello" s)))

(defn g [x]
  (let [y (inc x)]
    (* y 2)))

(defn b []
  (dotimes [i 3]
    #break (prn i)))

(comment
  (g 7)
  (b)
  (hello "foo")
  (System/getProperty "user.dir")
  (js/console.log "foo")
  (do (Thread/sleep 30000) :slept)
  :rcf)

