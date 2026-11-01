(ns main.common)

(defn hello [s]
  #?(:cljs (js/console.log "Hello" s)
     :clj (println "Hello" s)))

(comment
  (hello "foo")
  (System/getProperty "user.dir")
  (js/console.log "foo")
  (do (Thread/sleep 30000) :slept)
  :rcf)

