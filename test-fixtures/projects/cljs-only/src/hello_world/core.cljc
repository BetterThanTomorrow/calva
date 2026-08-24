(ns hello-world.core)

(comment
  #?(:cljs (js/console.log "cljc from js")
     :clj (.println System/out "cljc from jvm"))
  :rcf)

