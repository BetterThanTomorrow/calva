(ns main2.common2)

(defn hello [s]
  #?(:cljs (js/console.log "Hello" s)
     :clj (println "Hello" s)))

(comment
  (hello "foo")
  (System/getProperty "user.dir")
  (js/console.log "foo")
  :rcf)

